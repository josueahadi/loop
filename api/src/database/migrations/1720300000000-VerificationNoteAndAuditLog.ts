import { MigrationInterface, QueryRunner } from 'typeorm';

// Admin hardening: capture a rejection reason on verification records, and an
// audit trail of admin decisions (who did what, when, from where).
export class VerificationNoteAndAuditLog1720300000000
  implements MigrationInterface
{
  name = 'VerificationNoteAndAuditLog1720300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "verification_records" ADD COLUMN "review_note" text`,
    );

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
        "action" text NOT NULL,
        "target_type" text,
        "target_id" uuid,
        "ip" text,
        "user_agent" text,
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" ("created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_audit_logs_actor_id" ON "audit_logs" ("actor_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(
      `ALTER TABLE "verification_records" DROP COLUMN "review_note"`,
    );
  }
}
