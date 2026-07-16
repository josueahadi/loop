import { MigrationInterface, QueryRunner } from 'typeorm';

// M7 pricing v2: add a min_fare floor and a rate_per_min time term to
// pricing_config, and persist on the JOB the distance/duration/source actually
// used for the estimate (instrumentation for a future learned pricing model).
//
// The seeded min_fare / rate_per_min are PLACEHOLDERS pending field research —
// same status as the existing base_fare / rate_per_km. RWF integers.
export class PricingV2AndJobRouteMetrics1720700000000 implements MigrationInterface {
  name = 'PricingV2AndJobRouteMetrics1720700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pricing_config" ADD COLUMN "min_fare" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_config" ADD COLUMN "rate_per_min" integer NOT NULL DEFAULT 0`,
    );

    // Placeholder rates (whole RWF), flagged for field research. Keyed by the
    // canonical vehicle_type enum.
    const seed: Record<string, { minFare: number; ratePerMin: number }> = {
      moto: { minFare: 800, ratePerMin: 30 },
      pickup: { minFare: 1500, ratePerMin: 60 },
      van: { minFare: 2000, ratePerMin: 80 },
      small_truck: { minFare: 3000, ratePerMin: 120 },
      large_truck: { minFare: 5000, ratePerMin: 200 },
    };
    for (const [vt, v] of Object.entries(seed)) {
      await queryRunner.query(
        `UPDATE "pricing_config" SET "min_fare" = $1, "rate_per_min" = $2 WHERE "vehicle_type" = $3`,
        [v.minFare, v.ratePerMin, vt],
      );
    }

    // JOB: the route inputs actually used for the estimate.
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD COLUMN "distance_km" numeric(7,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD COLUMN "duration_min" numeric(7,1)`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ADD COLUMN "distance_source" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "distance_source"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "duration_min"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "distance_km"`);
    await queryRunner.query(
      `ALTER TABLE "pricing_config" DROP COLUMN "rate_per_min"`,
    );
    await queryRunner.query(
      `ALTER TABLE "pricing_config" DROP COLUMN "min_fare"`,
    );
  }
}
