import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserSuspension1721000000000 implements MigrationInterface {
  name = 'UserSuspension1721000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "suspended_at" timestamptz`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "suspended_at"`,
    );
  }
}
