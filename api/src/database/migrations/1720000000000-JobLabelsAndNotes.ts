import { MigrationInterface, QueryRunner } from 'typeorm';

// M3.5: pins can now carry a reverse-geocoded display label + a free-text note.
// The existing pickup/drop_off text columns held the label, so rename them to
// *_label (and make nullable), then add *_notes.
export class JobLabelsAndNotes1720000000000 implements MigrationInterface {
  name = 'JobLabelsAndNotes1720000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "jobs" RENAME COLUMN "pickup" TO "pickup_label"`);
    await queryRunner.query(`ALTER TABLE "jobs" RENAME COLUMN "drop_off" TO "drop_off_label"`);
    await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "pickup_label" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "drop_off_label" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "jobs" ADD COLUMN "pickup_notes" text`);
    await queryRunner.query(`ALTER TABLE "jobs" ADD COLUMN "drop_off_notes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "drop_off_notes"`);
    await queryRunner.query(`ALTER TABLE "jobs" DROP COLUMN "pickup_notes"`);
    await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "drop_off_label" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "jobs" ALTER COLUMN "pickup_label" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "jobs" RENAME COLUMN "drop_off_label" TO "drop_off"`);
    await queryRunner.query(`ALTER TABLE "jobs" RENAME COLUMN "pickup_label" TO "pickup"`);
  }
}
