import { MigrationInterface, QueryRunner } from 'typeorm';

// Driver's licence number, captured alongside the uploaded licence document.
export class UserLicenseNumber1720400000000 implements MigrationInterface {
  name = 'UserLicenseNumber1720400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "license_number" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "license_number"`,
    );
  }
}
