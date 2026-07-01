import { MigrationInterface, QueryRunner } from 'typeorm';

// Terminology: the computed figure is a COST ESTIMATE (ride-hailing style), not a
// marketplace "suggestion". Rename jobs.suggested_price → estimated_price. The
// owner-set `price` stays a separate column; behaviour is unchanged.
export class RenameSuggestedPrice1719900000000 implements MigrationInterface {
  name = 'RenameSuggestedPrice1719900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jobs" RENAME COLUMN "suggested_price" TO "estimated_price"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "jobs" RENAME COLUMN "estimated_price" TO "suggested_price"`,
    );
  }
}
