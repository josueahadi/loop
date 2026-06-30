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
  const users = ds.getRepository(User);
  const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@loop.rw').toLowerCase();
  const existingAdmin = await users.findOne({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(
      process.env.ADMIN_PASSWORD ?? 'change-me-admin',
    );
    await users.save(
      users.create({
        name: process.env.ADMIN_NAME ?? 'Loop Admin',
        email: adminEmail,
        phone: process.env.ADMIN_PHONE ?? '+250780000000',
        passwordHash,
        role: UserRole.ADMIN,
        availabilityStatus: null,
        emailVerifiedAt: new Date(),
        averageRating: 0,
      }),
    );
    console.log(`Seeded admin: ${adminEmail}`);
  } else {
    console.log(`Admin already present: ${adminEmail}`);
  }

  // ---- pricing config (per vehicle type, RWF integers) ----
  const pricing = ds.getRepository(PricingConfig);
  const defaults: Record<VehicleType, { baseFare: number; ratePerKm: number }> = {
    [VehicleType.MOTO]: { baseFare: 1000, ratePerKm: 300 },
    [VehicleType.PICKUP]: { baseFare: 3000, ratePerKm: 600 },
    [VehicleType.VAN]: { baseFare: 4000, ratePerKm: 800 },
    [VehicleType.SMALL_TRUCK]: { baseFare: 6000, ratePerKm: 1200 },
    [VehicleType.LARGE_TRUCK]: { baseFare: 10000, ratePerKm: 2000 },
  };
  for (const [vehicleType, vals] of Object.entries(defaults)) {
    const exists = await pricing.findOne({
      where: { vehicleType: vehicleType as VehicleType },
    });
    if (!exists) {
      await pricing.save(
        pricing.create({ vehicleType: vehicleType as VehicleType, ...vals }),
      );
    }
  }
  console.log('Seeded pricing_config');

  // ---- size multipliers ----
  const sizes = ds.getRepository(SizeMultiplier);
  const sizeDefaults: Record<JobSize, number> = {
    [JobSize.SMALL]: 1.0,
    [JobSize.MEDIUM]: 1.3,
    [JobSize.LARGE]: 1.7,
  };
  for (const [size, multiplier] of Object.entries(sizeDefaults)) {
    const exists = await sizes.findOne({ where: { size: size as JobSize } });
    if (!exists) {
      await sizes.save(sizes.create({ size: size as JobSize, multiplier }));
    }
  }
  console.log('Seeded size_multipliers');

  await ds.destroy();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
