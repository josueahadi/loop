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

  // ---- admin user ----
  // Upsert: create the admin if missing, otherwise refresh password/name/phone
  // from the current env vars. This keeps the seed idempotent AND self-healing —
  // rotating ADMIN_PASSWORD and re-running the seed updates the login, rather than
  // silently keeping a stale password. (No public admin signup exists.)
  const users = ds.getRepository(User);
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@loop.rw').toLowerCase();
  const passwordHash = await argon2.hash(
    process.env.ADMIN_PASSWORD ?? 'change-me-admin',
  );
  const adminName = process.env.ADMIN_NAME ?? 'Loop Admin';
  const adminPhone = process.env.ADMIN_PHONE ?? '+250780000000';
  const existingAdmin = await users.findOne({ where: { email: adminEmail } });
  if (existingAdmin) {
    existingAdmin.name = adminName;
    existingAdmin.phone = adminPhone;
    existingAdmin.passwordHash = passwordHash;
    existingAdmin.role = UserRole.ADMIN;
    await users.save(existingAdmin);
    console.log(`Updated admin: ${adminEmail}`);
  } else {
    await users.save(
      users.create({
        name: adminName,
        email: adminEmail,
        phone: adminPhone,
        passwordHash,
        role: UserRole.ADMIN,
        availabilityStatus: null,
        emailVerifiedAt: new Date(),
        averageRating: 0,
      }),
    );
    console.log(`Seeded admin: ${adminEmail}`);
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
