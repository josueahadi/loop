import { MigrationInterface, QueryRunner } from 'typeorm';

// M4: store a device's FCM registration token so we can push to a user.
export class UserFcmToken1720100000000 implements MigrationInterface {
  name = 'UserFcmToken1720100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "fcm_token" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "fcm_token"`);
  }
}
