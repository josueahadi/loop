import { MigrationInterface, QueryRunner } from 'typeorm';

// Detach (don't destroy) the records a deleted user shares with a counterparty.
//
// - messages.sender_id / receiver_id: SET NULL, so deleting one participant does
//   not erase the OTHER person's side of the conversation. A message with a null
//   participant reads as "deleted user".
// - ratings.from_user_id: SET NULL, so a rating the deleted user GAVE survives as
//   part of the counterparty's reputation (the deletion service recomputes the
//   ratee's average afterwards). ratings.to_user_id stays CASCADE — a rating a
//   user RECEIVED is about them, and goes with them.
//
// Jobs stay CASCADE: a job is the owner's own request; its value to the driver is
// preserved through the surviving rating and payment, not an owner-less job row.
export class DetachSharedRecordsOnDeletion1721300000000
  implements MigrationInterface
{
  name = 'DetachSharedRecordsOnDeletion1721300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // messages: sender + receiver -> SET NULL, nullable
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "fk_messages_sender"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "fk_messages_receiver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "sender_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "receiver_id" DROP NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "messages" ADD CONSTRAINT "fk_messages_sender"
        FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "messages" ADD CONSTRAINT "fk_messages_receiver"
        FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);

    // ratings: from_user -> SET NULL, nullable (given ratings survive)
    await queryRunner.query(
      `ALTER TABLE "ratings" DROP CONSTRAINT "fk_ratings_from"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ALTER COLUMN "from_user_id" DROP NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "ratings" ADD CONSTRAINT "fk_ratings_from"
        FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ratings" DROP CONSTRAINT "fk_ratings_from"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ratings" ALTER COLUMN "from_user_id" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "ratings" ADD CONSTRAINT "fk_ratings_from"
        FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "fk_messages_sender"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "fk_messages_receiver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "sender_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "receiver_id" SET NOT NULL`,
    );
    await queryRunner.query(`
      ALTER TABLE "messages" ADD CONSTRAINT "fk_messages_sender"
        FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
    await queryRunner.query(`
      ALTER TABLE "messages" ADD CONSTRAINT "fk_messages_receiver"
        FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);
  }
}
