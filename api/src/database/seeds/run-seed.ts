import 'dotenv/config';
import * as argon2 from 'argon2';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from '../data-source';
import { JobSize, UserRole, VehicleType } from '../../common/enums';
import { User } from '../../modules/users/entities/user.entity';
import { PricingConfig } from '../../modules/pricing/entities/pricing-config.entity';
import { SizeMultiplier } from '../../modules/pricing/entities/size-multiplier.entity';

// Idempotent seed: the admin account (no public admin signup) + pricing config.
// Placeholder field-research values — editable without redeploy.
async function seed() {
  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();

  const users = ds.getRepository(User);

  // Upsert an admin: create if missing, otherwise refresh password/name/phone.
  // Idempotent AND self-healing — rotating the password and re-running the seed
  // updates the login rather than keeping a stale one. (No public admin signup.)
  async function upsertAdmin(
    email: string,
    password: string,
    name: string,
    phone: string,
  ): Promise<void> {
    const lower = email.toLowerCase();
    const passwordHash = await argon2.hash(password);
    const existing = await users.findOne({ where: { email: lower } });
    if (existing) {
      existing.name = name;
      existing.phone = phone;
      existing.passwordHash = passwordHash;
      existing.role = UserRole.ADMIN;
      await users.save(existing);
      console.log(`Updated admin: ${lower}`);
    } else {
      await users.save(
        users.create({
          name,
          email: lower,
          phone,
          passwordHash,
          role: UserRole.ADMIN,
          availabilityStatus: null,
          emailVerifiedAt: new Date(),
          averageRating: 0,
        }),
      );
      console.log(`Seeded admin: ${lower}`);
    }
  }

  // ---- primary admin (env-driven) ----
  const primaryAdminEmail = (
    process.env.ADMIN_EMAIL ?? 'admin@loop.rw'
  ).toLowerCase();
  await upsertAdmin(
    primaryAdminEmail,
    process.env.ADMIN_PASSWORD ?? 'change-me-admin',
    process.env.ADMIN_NAME ?? 'Loop Admin',
    process.env.ADMIN_PHONE ?? '+250780000000',
  );

  // ---- demo/grader admin ----
  // A fixed, documented login so an evaluator can reach the admin console on the
  // deployed instance (there is no public admin signup). Throwaway credentials —
  // rotate or remove after evaluation. Overridable via env; skip by setting
  // DEMO_ADMIN_EMAIL empty. Skipped if it would collide with the primary admin
  // (e.g. a local run where both default to admin@loop.rw).
  const demoAdminEmail = (
    process.env.DEMO_ADMIN_EMAIL ?? 'admin@loop.rw'
  ).toLowerCase();
  if (demoAdminEmail && demoAdminEmail !== primaryAdminEmail) {
    await upsertAdmin(
      demoAdminEmail,
      process.env.DEMO_ADMIN_PASSWORD ?? 'Admin@2026',
      process.env.DEMO_ADMIN_NAME ?? 'Loop Demo Admin',
      process.env.DEMO_ADMIN_PHONE ?? '+250780000001',
    );
  }

  // ---- pricing config (per vehicle type, RWF integers) ----
  // PLACEHOLDER values — NOT field-researched. Replace with real Kigali rates
  // before launch. Editable at runtime (no redeploy). Upserted so re-seeding
  // corrects the values.
  const pricing = ds.getRepository(PricingConfig);
  const placeholderFares: Record<
    VehicleType,
    { baseFare: number; ratePerKm: number }
  > = {
    [VehicleType.MOTO]: { baseFare: 500, ratePerKm: 300 },
    [VehicleType.PICKUP]: { baseFare: 1000, ratePerKm: 600 },
    [VehicleType.VAN]: { baseFare: 1500, ratePerKm: 800 },
    [VehicleType.SMALL_TRUCK]: { baseFare: 2000, ratePerKm: 1200 },
    [VehicleType.LARGE_TRUCK]: { baseFare: 3000, ratePerKm: 2000 },
  };
  for (const [vehicleType, vals] of Object.entries(placeholderFares)) {
    await pricing.upsert({ vehicleType: vehicleType as VehicleType, ...vals }, [
      'vehicleType',
    ]);
  }
  console.log('Seeded pricing_config (PLACEHOLDER rates)');

  // ---- size multipliers (PLACEHOLDER) ----
  const sizes = ds.getRepository(SizeMultiplier);
  const sizeFactors: Record<JobSize, number> = {
    [JobSize.SMALL]: 1.0,
    [JobSize.MEDIUM]: 1.3,
    [JobSize.LARGE]: 1.6,
  };
  for (const [size, multiplier] of Object.entries(sizeFactors)) {
    await sizes.upsert({ size: size as JobSize, multiplier }, ['size']);
  }
  console.log('Seeded size_multipliers (PLACEHOLDER factors)');

  await ds.destroy();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
