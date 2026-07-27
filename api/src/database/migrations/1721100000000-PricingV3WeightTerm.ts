import { MigrationInterface, QueryRunner } from 'typeorm';

// Pricing v3: make weight a direct price term (add rate_per_kg to pricing_config)
// and recalibrate all rates to realistic Kigali levels. Addresses the feedback
// that a 150 kg load priced like a 10 kg load in the same size bucket, and that
// the placeholder fares were too low.
//
//   estimated_price = max( min_fare,
//                          base_fare + rate_per_km·km + rate_per_min·min
//                                    + rate_per_kg·weight )
//                     × size_factor
//
// RWF integers. Still rule-based + configurable (no ML). The time term is still
// dropped on the great-circle fallback; the weight term is dropped only when
// weight is unknown.
export class PricingV3WeightTerm1721100000000 implements MigrationInterface {
  name = 'PricingV3WeightTerm1721100000000';

  // v3 values: base_fare / rate_per_km / rate_per_min / rate_per_kg / min_fare.
  private static readonly v3: Record<
    string,
    {
      baseFare: number;
      ratePerKm: number;
      ratePerMin: number;
      ratePerKg: number;
      minFare: number;
    }
  > = {
    moto: { baseFare: 800, ratePerKm: 280, ratePerMin: 25, ratePerKg: 6, minFare: 1000 },
    pickup: { baseFare: 2500, ratePerKm: 550, ratePerMin: 50, ratePerKg: 8, minFare: 3000 },
    van: { baseFare: 3500, ratePerKm: 700, ratePerMin: 60, ratePerKg: 6, minFare: 4500 },
    small_truck: { baseFare: 5000, ratePerKm: 1000, ratePerMin: 90, ratePerKg: 4, minFare: 7000 },
    large_truck: { baseFare: 8000, ratePerKm: 1600, ratePerMin: 150, ratePerKg: 3, minFare: 12000 },
  };

  // Previous (v2) values, for a clean down().
  private static readonly v2: Record<
    string,
    { baseFare: number; ratePerKm: number; ratePerMin: number; minFare: number }
  > = {
    moto: { baseFare: 500, ratePerKm: 300, ratePerMin: 30, minFare: 800 },
    pickup: { baseFare: 1000, ratePerKm: 600, ratePerMin: 60, minFare: 1500 },
    van: { baseFare: 1500, ratePerKm: 800, ratePerMin: 80, minFare: 2000 },
    small_truck: { baseFare: 2000, ratePerKm: 1200, ratePerMin: 120, minFare: 3000 },
    large_truck: { baseFare: 3000, ratePerKm: 2000, ratePerMin: 200, minFare: 5000 },
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pricing_config" ADD COLUMN "rate_per_kg" integer NOT NULL DEFAULT 0`,
    );
    for (const [vt, v] of Object.entries(PricingV3WeightTerm1721100000000.v3)) {
      await queryRunner.query(
        `UPDATE "pricing_config"
           SET "base_fare" = $1, "rate_per_km" = $2, "rate_per_min" = $3,
               "rate_per_kg" = $4, "min_fare" = $5, "updated_at" = now()
         WHERE "vehicle_type" = $6`,
        [v.baseFare, v.ratePerKm, v.ratePerMin, v.ratePerKg, v.minFare, vt],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [vt, v] of Object.entries(PricingV3WeightTerm1721100000000.v2)) {
      await queryRunner.query(
        `UPDATE "pricing_config"
           SET "base_fare" = $1, "rate_per_km" = $2, "rate_per_min" = $3,
               "min_fare" = $4, "updated_at" = now()
         WHERE "vehicle_type" = $5`,
        [v.baseFare, v.ratePerKm, v.ratePerMin, v.minFare, vt],
      );
    }
    await queryRunner.query(
      `ALTER TABLE "pricing_config" DROP COLUMN "rate_per_kg"`,
    );
  }
}
