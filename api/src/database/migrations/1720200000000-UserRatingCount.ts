import { MigrationInterface, QueryRunner } from 'typeorm';

// M5: reputation aggregate. average_rating already exists (M1); add rating_count.
// Ratings are two-way, so both apply to owners and drivers alike.
export class UserRatingCount1720200000000 implements MigrationInterface {
  name = 'UserRatingCount1720200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "rating_count" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "rating_count"`);
  }
}
