import { MigrationInterface, QueryRunner } from 'typeorm';

// Account deletion support.
//
// 1. Payments detach instead of cascade. A payment is a financial record that
//    may be subject to a retention obligation, so deleting a user must NOT delete
//    their payment rows. payer_id/payee_id become nullable and ON DELETE SET NULL
//    — the amount, provider reference and timestamp survive with the user link
//    nulled (and the deletion service also nulls raw_webhook_payload, which can
//    carry provider-side PII).
//
// 2. account_blocklist keeps a minimal, hashed record when a driver is removed
//    for fraud (false documents), so the same email/phone cannot immediately
//    re-register. Only salted hashes are stored — never the raw email/phone.
export class AccountDeletion1721200000000 implements MigrationInterface {
  name = 'AccountDeletion1721200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- payments: CASCADE -> SET NULL, columns become nullable ---
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "fk_payment_payer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "fk_payment_payee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "payer_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "payee_id" DROP NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "payments" ADD CONSTRAINT "fk_payment_payer"
        FOREIGN KEY ("payer_id") REFERENCES "users" ("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ADD CONSTRAINT "fk_payment_payee"
        FOREIGN KEY ("payee_id") REFERENCES "users" ("id") ON DELETE SET NULL
    `);

    // --- account_blocklist ---
    await queryRunner.query(`
      CREATE TABLE "account_blocklist" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email_hash" varchar NOT NULL,
        "phone_hash" varchar NOT NULL,
        "reason" varchar NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_account_blocklist" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_blocklist_email_hash" ON "account_blocklist" ("email_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_blocklist_phone_hash" ON "account_blocklist" ("phone_hash")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "account_blocklist"`);

    // Restore the original CASCADE + NOT NULL payment FKs. (Rows with a nulled
    // payer/payee written while this migration was applied would block the NOT
    // NULL restore; acceptable for a dev-time down-migration.)
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "fk_payment_payer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "fk_payment_payee"`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "payer_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ALTER COLUMN "payee_id" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "payments" ADD CONSTRAINT "fk_payment_payer"
        FOREIGN KEY ("payer_id") REFERENCES "users" ("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "payments" ADD CONSTRAINT "fk_payment_payee"
        FOREIGN KEY ("payee_id") REFERENCES "users" ("id") ON DELETE CASCADE
    `);
  }
}
