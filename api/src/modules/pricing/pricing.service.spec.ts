import { BadRequestException } from '@nestjs/common';
import { JobSize, VehicleType } from '../../common/enums';
import { PricingService } from './pricing.service';

// Unit tests for the rule-based pricing formula:
//   estimated_price = base_fare + ( rate_per_km × distance_km ) × size_factor
// Repositories + the PostGIS distance query are mocked so these are pure and
// deterministic — the formula, rounding, and error paths are what we assert.
describe('PricingService.computeEstimatedPrice', () => {
  // A pricing_config row per vehicle type, and a size_multipliers row per size.
  const config: Record<string, { baseFare: number; ratePerKm: number }> = {
    [VehicleType.MOTO]: { baseFare: 1000, ratePerKm: 300 },
    [VehicleType.PICKUP]: { baseFare: 2000, ratePerKm: 500 },
    [VehicleType.SMALL_TRUCK]: { baseFare: 5000, ratePerKm: 800 },
  };
  const multipliers: Record<string, number> = {
    [JobSize.SMALL]: 1.0,
    [JobSize.MEDIUM]: 1.5,
    [JobSize.LARGE]: 2.0,
  };

  function makeService(): PricingService {
    const pricingRepo = {
      findOne: jest.fn(({ where }: { where: { vehicleType: string } }) =>
        Promise.resolve(
          config[where.vehicleType]
            ? { vehicleType: where.vehicleType, ...config[where.vehicleType] }
            : null,
        ),
      ),
    };
    const sizeRepo = {
      findOne: jest.fn(({ where }: { where: { size: string } }) =>
        Promise.resolve(
          multipliers[where.size] != null
            ? { size: where.size, multiplier: multipliers[where.size] }
            : null,
        ),
      ),
    };
    // DataSource isn't used by computeEstimatedPrice; pass a stub.
    return new PricingService({} as any, pricingRepo as any, sizeRepo as any);
  }

  it('applies base_fare + rate_per_km × distance × size_factor', async () => {
    const service = makeService();
    // moto: 1000 + 300 × 10 × 1.0 = 4000
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.MOTO,
        size: JobSize.SMALL,
        distanceKm: 10,
      }),
    ).resolves.toBe(4000);
  });

  it('scales by the size multiplier', async () => {
    const service = makeService();
    // pickup large: 2000 + 500 × 8 × 2.0 = 10000
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.PICKUP,
        size: JobSize.LARGE,
        distanceKm: 8,
      }),
    ).resolves.toBe(10000);
  });

  it('rounds to whole RWF (zero-decimal currency, no minor units)', async () => {
    const service = makeService();
    // moto medium: 1000 + 300 × 3.33 × 1.5 = 2498.5 → 2499
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.MOTO,
        size: JobSize.MEDIUM,
        distanceKm: 3.33,
      }),
    ).resolves.toBe(2499);
  });

  it('returns just the base fare at zero distance', async () => {
    const service = makeService();
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.SMALL_TRUCK,
        size: JobSize.SMALL,
        distanceKm: 0,
      }),
    ).resolves.toBe(5000);
  });

  it('throws when no pricing is configured for the vehicle type', async () => {
    const service = makeService();
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.LARGE_TRUCK, // not seeded above
        size: JobSize.SMALL,
        distanceKm: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when no multiplier exists for the size', async () => {
    const service = makeService();
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.MOTO,
        size: 'huge' as JobSize, // not a real size
        distanceKm: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
