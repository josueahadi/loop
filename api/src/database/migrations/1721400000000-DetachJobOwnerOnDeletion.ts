import { MigrationInterface, QueryRunner } from 'typeorm';

// Complete the two-party detach. Messages and ratings hang off a JOB, and the
// job previously cascade-deleted when its owner was deleted — which destroyed the
// counterparty's messages/ratings through the job, defeating the SET NULL on the
// message/rating user FKs. Making jobs.owner_id nullable + ON DELETE SET NULL
// keeps a completed job as an anonymised record, so the conversation and the
// rating the deleted user gave survive for the counterparty.
//
// Owner-scoped queries filter `owner_id = $me`, which a null owner never matches,
// so a detached job is invisible to any live user; admin owner-directory joins
// are INNER, so it simply drops out of the owner listing.
export class DetachJobOwnerOnDeletion1721400000000
  implements MigrationInterface
{
  name = 'DetachJobOwnerOnDeletion1721400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "fk_jobs_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ALTER COLUMN "owner_id" DROP NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "jobs" ADD CONSTRAINT "fk_jobs_owner"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jobs" DROP CONSTRAINT "fk_jobs_owner"`,
    );
    await queryRunner.query(
      `ALTER TABLE "jobs" ALTER COLUMN "owner_id" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "jobs" ADD CONSTRAINT "fk_jobs_owner"
        FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }
}
