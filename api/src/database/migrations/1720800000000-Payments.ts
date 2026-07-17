import { MigrationInterface, QueryRunner } from 'typeorm';

// M8 pass-through payments. Records a settlement confirmed by the provider
// webhook — Loop never holds the funds. The partial unique index enforces at
// most one successful payment per job at the data layer (same discipline as
// M4's one-accepted-proposal-per-job).
export class Payments1720800000000 implements MigrationInterface {
  name = 'Payments1720800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "payment_status" AS ENUM
        ('pending', 'successful', 'failed', 'cancelled')
    `);
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "job_id" uuid NOT NULL,
        "payer_id" uuid NOT NULL,
        "payee_id" uuid NOT NULL,
        "amount" integer NOT NULL,
        "currency" varchar NOT NULL DEFAULT 'RWF',
        "provider" varchar NOT NULL,
        "provider_ref" varchar NOT NULL,
        "status" "payment_status" NOT NULL DEFAULT 'pending',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "paid_at" timestamptz,
        "failure_reason" varchar,
        "raw_webhook_payload" jsonb,
        CONSTRAINT "pk_payments" PRIMARY KEY ("id"),
        CONSTRAINT "fk_payment_job" FOREIGN KEY ("job_id")
          REFERENCES "jobs" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_payment_payer" FOREIGN KEY ("payer_id")
          REFERENCES "users" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_payment_payee" FOREIGN KEY ("payee_id")
          REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_payment_job" ON "payments" ("job_id")`,
    );
    // provider_ref is the webhook idempotency key — globally unique.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "uq_payment_provider_ref" ON "payments" ("provider_ref")`,
    );
    // At most one SUCCESSFUL payment per job (no double settlement).
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_payment_job_successful"
        ON "payments" ("job_id") WHERE "status" = 'successful'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TYPE "payment_status"`);
  }
}
