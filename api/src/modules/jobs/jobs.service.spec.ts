import { ConflictException, NotFoundException } from '@nestjs/common';
import { JobSize, JobStatus, VehicleType } from '../../common/enums';
import { CreateJobDto } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

// Unit tests for the job lifecycle and create-persistence. jobs.service talks to
// Postgres via raw dataSource.query, so we mock query and assert (a) the exact
// parameters an INSERT is given, and (b) the owner-driven status-transition
// rules. The real SQL/PostGIS is exercised by the integration test.
describe('JobsService', () => {
  const OWNER = 'owner-1';
  const OTHER = 'someone-else';
  const JOB = 'job-1';

  // A DTO with every field populated, including the M7 route metrics.
  function fullDto(): CreateJobDto {
    return {
      pickup: { lat: -1.94, lng: 30.06 },
      dropOff: { lat: -1.95, lng: 30.1 },
      pickupLabel: 'Nyamirambo',
      pickupNotes: 'blue gate',
      dropOffLabel: 'Remera',
      dropOffNotes: 'ask for John',
      cargoType: 'boxes',
      size: JobSize.MEDIUM,
      weightKg: 120,
      estimatedPrice: 8200,
      price: 8000,
      distanceKm: 14.97,
      durationMin: 17.5,
      distanceSource: 'osrm',
      reqVehicleType: VehicleType.PICKUP,
    } as CreateJobDto;
  }

  // Build a service whose dataSource.query is driven by `handler`.
  function make(handler: (sql: string, params: unknown[]) => unknown) {
    const calls: { sql: string; params: unknown[] }[] = [];
    const dataSource = {
      query: jest.fn((sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return Promise.resolve(handler(sql, params));
      }),
    };
    return { service: new JobsService(dataSource as never), calls };
  }

  // A row shaped like the SELECT projection, at a given status.
  const rowAt = (status: JobStatus) => ({
    id: JOB,
    ownerId: OWNER,
    status,
    estimatedPrice: 8200,
    price: 8000,
  });

  describe('create', () => {
    it('persists prices and the M7 route metrics in the INSERT params', async () => {
      const { service, calls } = make((sql) => {
        if (sql.includes('INSERT INTO jobs')) return [{ id: JOB }];
        return [rowAt(JobStatus.POSTED)]; // the getOwned re-read
      });

      await service.create(OWNER, fullDto());

      const insert = calls.find((c) => c.sql.includes('INSERT INTO jobs'))!;
      const p = insert.params;
      // owner + both prices + all three route-metric fields must be bound.
      expect(p[0]).toBe(OWNER);
      expect(p).toContain(8200); // estimated_price
      expect(p).toContain(8000); // posted price
      expect(p).toContain(14.97); // distance_km
      expect(p).toContain(17.5); // duration_min
      expect(p).toContain('osrm'); // distance_source
    });

    it('binds null for the optional route metrics when omitted', async () => {
      const dto = { ...fullDto() };
      delete (dto as { distanceKm?: number }).distanceKm;
      delete (dto as { durationMin?: number }).durationMin;
      delete (dto as { distanceSource?: string }).distanceSource;

      const { service, calls } = make((sql) =>
        sql.includes('INSERT INTO jobs')
          ? [{ id: JOB }]
          : [rowAt(JobStatus.POSTED)],
      );
      await service.create(OWNER, dto as CreateJobDto);

      const insert = calls.find((c) => c.sql.includes('INSERT INTO jobs'))!;
      // The last three data params (distance_km, duration_min, distance_source)
      // become null rather than throwing.
      expect(insert.params).toContain(null);
    });
  });

  describe('updateStatus lifecycle', () => {
    it('rejects a direct posted -> matched (matching only happens via proposal accept)', async () => {
      const { service } = make(() => [rowAt(JobStatus.POSTED)]);
      await expect(
        service.updateStatus(JOB, OWNER, JobStatus.MATCHED),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows matched -> in_progress -> completed in order', async () => {
      // matched -> in_progress
      let current = JobStatus.MATCHED;
      const { service } = make((sql) => {
        if (sql.startsWith('UPDATE jobs')) {
          current = JobStatus.IN_PROGRESS;
          return [];
        }
        return [rowAt(current)];
      });
      await expect(
        service.updateStatus(JOB, OWNER, JobStatus.IN_PROGRESS),
      ).resolves.toMatchObject({ status: JobStatus.IN_PROGRESS });

      // in_progress -> completed
      let cur2 = JobStatus.IN_PROGRESS;
      const svc2 = make((sql) => {
        if (sql.startsWith('UPDATE jobs')) {
          cur2 = JobStatus.COMPLETED;
          return [];
        }
        return [rowAt(cur2)];
      });
      await expect(
        svc2.service.updateStatus(JOB, OWNER, JobStatus.COMPLETED),
      ).resolves.toMatchObject({ status: JobStatus.COMPLETED });
    });

    it('rejects an out-of-order jump (matched -> completed)', async () => {
      const { service } = make(() => [rowAt(JobStatus.MATCHED)]);
      await expect(
        service.updateStatus(JOB, OWNER, JobStatus.COMPLETED),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows cancel from posted and from matched', async () => {
      for (const from of [JobStatus.POSTED, JobStatus.MATCHED]) {
        let cur = from;
        const { service } = make((sql) => {
          if (sql.startsWith('UPDATE jobs')) {
            cur = JobStatus.CANCELLED;
            return [];
          }
          return [rowAt(cur)];
        });
        await expect(
          service.updateStatus(JOB, OWNER, JobStatus.CANCELLED),
        ).resolves.toMatchObject({ status: JobStatus.CANCELLED });
      }
    });

    it('rejects cancel from in_progress (only completion is allowed there)', async () => {
      const { service } = make(() => [rowAt(JobStatus.IN_PROGRESS)]);
      await expect(
        service.updateStatus(JOB, OWNER, JobStatus.CANCELLED),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('only the owner can advance a job — a non-owner read finds nothing (404)', async () => {
      // getOwned filters on owner_id, so a job the caller does not own returns no
      // rows and surfaces as NotFound. (The controller is also @Roles-gated to
      // cargo_owner; ownership is the row-level guard.)
      const { service } = make((sql) =>
        sql.includes('WHERE id = $1 AND owner_id = $2') ? [] : [],
      );
      await expect(
        service.updateStatus(JOB, OTHER, JobStatus.IN_PROGRESS),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
