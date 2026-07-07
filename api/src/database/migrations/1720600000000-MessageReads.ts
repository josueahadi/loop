import { MigrationInterface, QueryRunner } from 'typeorm';

// Per-user, per-job read marker so job cards can show unread-message counts.
export class MessageReads1720600000000 implements MigrationInterface {
  name = 'MessageReads1720600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "message_reads" (
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "job_id" uuid NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
        "last_read_at" timestamptz NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id", "job_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "message_reads"`);
  }
}
