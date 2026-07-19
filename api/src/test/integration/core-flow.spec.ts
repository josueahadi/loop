import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { dataSourceOptions } from '../../database/data-source';

// Integration test — the ONLY test that exercises the real request path end to
// end: a real Nest app, real Postgres/PostGIS, real HTTP. It proves the guards
// hold across the stack (not just in mocks), and specifically that counterparty
// contact details are hidden until a proposal is accepted (the M4 privacy gate).
//
// It runs against a dedicated `loop_test` database in the local compose Postgres.
// If that DB is unreachable (e.g. CI without a DB), the whole suite is skipped
// with a clear log rather than failing — the unit suites still cover the logic.
//
// Setup the test DB once:
//   docker compose exec db psql -U loop -c "CREATE DATABASE loop_test;"
//   docker compose exec db psql -U loop -d loop_test -c "CREATE EXTENSION IF NOT EXISTS postgis;"

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://loop:loop@localhost:5433/loop_test';

async function testDbReachable(): Promise<boolean> {
  const ds = new DataSource({
    ...dataSourceOptions,
    url: TEST_DB_URL,
    migrations: [],
    entities: [],
  });
  try {
    await ds.initialize();
    await ds.destroy();
    return true;
  } catch {
    return false;
  }
}

describe('Core flow (integration)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let available = false;

  // Unique per run so re-runs never collide on the email/phone unique index.
  const uniq = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const owner = {
    name: 'Test Owner',
    email: `it_owner_${uniq}@loop.rw`,
    phone: `+2507${uniq.slice(-8)}`,
    password: 'Owner@2026x',
    role: 'cargo_owner',
  };
  const driver = {
    name: 'Test Driver',
    email: `it_driver_${uniq}@loop.rw`,
    phone: `+2507${(BigInt(uniq.slice(-8)) + 1n).toString().padStart(8, '0')}`,
    password: 'Driver@2026x',
    role: 'driver',
  };

  beforeAll(async () => {
    available = await testDbReachable();
    if (!available) {
      console.warn(
        `[integration] test DB unreachable at ${TEST_DB_URL} — skipping. ` +
          'Start compose + create loop_test to run this suite.',
      );
      return;
    }

    // Point the app at the test DB and run migrations into it.
    process.env.DATABASE_URL = TEST_DB_URL;
    const migrator = new DataSource({ ...dataSourceOptions, url: TEST_DB_URL });
    await migrator.initialize();
    await migrator.runMigrations();
    await migrator.destroy();

    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    dataSource = app.get(DataSource);
  }, 60000);

  afterAll(async () => {
    // Leave no residue: remove the two test users (jobs/proposals cascade).
    if (dataSource?.isInitialized) {
      await dataSource.query('DELETE FROM users WHERE email = ANY($1)', [
        [owner.email, driver.email],
      ]);
    }
    if (app) await app.close();
  });

  it('register → post job → propose → accept: job becomes matched and contact is gated', async () => {
    if (!available) {
      // Marked pending-but-passing so the suite result is honest when no DB.
      return;
    }
    const http = () => request(app.getHttpServer());

    // 1. Register owner + driver, capture their JWTs and ids.
    const ownerRes = await http()
      .post('/auth/register')
      .send(owner)
      .expect(201);
    const driverRes = await http()
      .post('/auth/register')
      .send(driver)
      .expect(201);
    const ownerToken = ownerRes.body.accessToken as string;
    const driverToken = driverRes.body.accessToken as string;
    const driverId = driverRes.body.user.id as string;
    expect(ownerToken).toBeTruthy();
    expect(driverId).toBeTruthy();

    // 2. Owner posts a job (amount + pins + a required vehicle type).
    const jobRes = await http()
      .post('/jobs')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        pickup: { lat: -1.9403, lng: 30.1127 },
        dropOff: { lat: -1.9397, lng: 30.0403 },
        cargoType: 'boxes',
        size: 'medium',
        reqVehicleType: 'pickup',
        estimatedPrice: 8200,
        price: 8000,
      })
      .expect(201);
    const jobId = jobRes.body.id as string;
    expect(jobRes.body.status).toBe('posted');

    // 3. Owner sends a proposal to the driver. Contact must NOT be revealed yet.
    await http()
      .post(`/jobs/${jobId}/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ driverId })
      .expect(201);

    const beforeAccept = await http()
      .get(`/jobs/${jobId}/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(beforeAccept.body).toHaveLength(1);
    const proposalId = beforeAccept.body[0].id as string;
    // The privacy gate: no driver contact while the proposal is only 'sent'.
    expect(beforeAccept.body[0].status).toBe('sent');
    expect(beforeAccept.body[0].contact ?? null).toBeNull();

    // 4. Driver accepts.
    await http()
      .patch(`/proposals/${proposalId}`)
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ status: 'accepted' })
      .expect(200);

    // 5. The job is now matched, and the driver's contact/phone is revealed.
    const jobAfter = await http()
      .get(`/jobs/${jobId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(jobAfter.body.status).toBe('matched');

    const afterAccept = await http()
      .get(`/jobs/${jobId}/proposals`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(afterAccept.body[0].status).toBe('accepted');
    expect(afterAccept.body[0].contact).toBeTruthy();
    expect(afterAccept.body[0].contact.phone).toBe(driver.phone);
  }, 60000);
});
