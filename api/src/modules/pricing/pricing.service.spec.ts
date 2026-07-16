import { BadRequestException } from '@nestjs/common';
import { JobSize, VehicleType } from '../../common/enums';
import { PricingService } from './pricing.service';

// Unit tests for pricing v2:
//   estimated_price = max( min_fare,
//                          base_fare + rate_per_km × km + rate_per_min × min )
//                     × size_factor
// Repositories are mocked (RoutingService is unused by computeEstimatedPrice, so
// it is stubbed) — these are pure, deterministic assertions on the formula, the
// min_fare floor, the omitted time term on fallback, rounding, and error paths.
describe('PricingService.computeEstimatedPrice (v2)', () => {
  const config: Record<
    string,
    { baseFare: number; ratePerKm: number; ratePerMin: number; minFare: number }
  > = {
    [VehicleType.MOTO]: {
      baseFare: 1000,
      ratePerKm: 300,
      ratePerMin: 30,
      minFare: 1500,
    },
    [VehicleType.PICKUP]: {
      baseFare: 2000,
      ratePerKm: 500,
      ratePerMin: 60,
      minFare: 3000,
    },
    [VehicleType.SMALL_TRUCK]: {
      baseFare: 5000,
      ratePerKm: 800,
      ratePerMin: 120,
      minFare: 6000,
    },
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
    // RoutingService is only used by estimate(), not computeEstimatedPrice.
    return new PricingService(pricingRepo as any, sizeRepo as any, {} as any);
  }

  it('applies base + rate_per_km × km + rate_per_min × min, then size_factor', async () => {
    const service = makeService();
    // moto small: (1000 + 300×10 + 30×20) × 1.0 = 1000+3000+600 = 4600
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.MOTO,
        size: JobSize.SMALL,
        distanceKm: 10,
        durationMin: 20,
      }),
    ).resolves.toBe(4600);
  });

  it('scales the whole variable cost by size_factor', async () => {
    const service = makeService();
    // pickup large: (2000 + 500×8 + 60×15) × 2.0 = (2000+4000+900)×2 = 13800
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.PICKUP,
        size: JobSize.LARGE,
        distanceKm: 8,
        durationMin: 15,
      }),
    ).resolves.toBe(13800);
  });

  it('omits the time term when duration is null (great-circle fallback)', async () => {
    const service = makeService();
    // moto small, no duration: (1000 + 300×10) × 1.0 = 4000 (no time term)
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.MOTO,
        size: JobSize.SMALL,
        distanceKm: 10,
        durationMin: null,
      }),
    ).resolves.toBe(4000);
  });

  it('applies the min_fare floor on a very short trip', async () => {
    const service = makeService();
    // moto small, tiny trip: variable = 1000 + 300×0.2 + 30×1 = 1090;
    // floor min_fare=1500 wins → 1500 × 1.0 = 1500
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.MOTO,
        size: JobSize.SMALL,
        distanceKm: 0.2,
        durationMin: 1,
      }),
    ).resolves.toBe(1500);
  });

  it('scales the min_fare floor by size_factor (floor is inside the max)', async () => {
    const service = makeService();
    // moto large, tiny trip: floor 1500 beats variable, then × 2.0 = 3000
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.MOTO,
        size: JobSize.LARGE,
        distanceKm: 0.2,
        durationMin: 1,
      }),
    ).resolves.toBe(3000);
  });

  it('rounds to whole RWF (zero-decimal currency, no minor units)', async () => {
    const service = makeService();
    // moto medium: (1000 + 300×3.33 + 30×2.5) × 1.5
    //            = (1000 + 999 + 75) × 1.5 = 2074 × 1.5 = 3111
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.MOTO,
        size: JobSize.MEDIUM,
        distanceKm: 3.33,
        durationMin: 2.5,
      }),
    ).resolves.toBe(3111);
  });

  it('throws when no pricing is configured for the vehicle type', async () => {
    const service = makeService();
    await expect(
      service.computeEstimatedPrice({
        vehicleType: VehicleType.LARGE_TRUCK, // not seeded above
        size: JobSize.SMALL,
        distanceKm: 5,
        durationMin: 10,
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
        durationMin: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
