import { MigrationInterface, QueryRunner } from 'typeorm';

// M1 foundation schema: all 8 core entities + auth token tables + pricing config,
// so metrics data accrues from day one. PostGIS geography columns for driver/job location.
export class InitialSchema1719700000000 implements MigrationInterface {
  name = 'InitialSchema1719700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    // ---- enum types ----
    await queryRunner.query(`CREATE TYPE "user_role" AS ENUM ('cargo_owner','driver','admin')`);
    await queryRunner.query(`CREATE TYPE "availability_status" AS ENUM ('online','offline')`);
    await queryRunner.query(`CREATE TYPE "vehicle_type" AS ENUM ('moto','pickup','van','small_truck','large_truck')`);
    await queryRunner.query(`CREATE TYPE "job_status" AS ENUM ('draft','posted','matched','in_progress','completed','cancelled')`);
    await queryRunner.query(`CREATE TYPE "job_size" AS ENUM ('small','medium','large')`);
    await queryRunner.query(`CREATE TYPE "proposal_status" AS ENUM ('sent','accepted','declined')`);
    await queryRunner.query(`CREATE TYPE "document_type" AS ENUM ('licence','national_id','vehicle_reg')`);
    await queryRunner.query(`CREATE TYPE "verification_status" AS ENUM ('pending','approved','rejected')`);
    await queryRunner.query(`CREATE TYPE "action_token_type" AS ENUM ('password_reset','email_verify')`);

    // ---- users ----
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "phone" varchar NOT NULL,
        "email" varchar NOT NULL,
        "password_hash" varchar NOT NULL,
        "role" "user_role" NOT NULL,
        "photo_url" varchar,
        "email_verified_at" timestamptz,
        "availability_status" "availability_status",
        "location" geography(Point,4326),
        "average_rating" numeric(2,1) NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_users" PRIMARY KEY ("id"),
        CONSTRAINT "uq_users_email" UNIQUE ("email"),
        CONSTRAINT "uq_users_phone" UNIQUE ("phone")
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_users_location" ON "users" USING GIST ("location")`);

    // ---- refresh_tokens ----
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" varchar NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_refresh_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_hash" ON "refresh_tokens" ("token_hash")`);

    // ---- action_tokens (reset / verify) ----
    await queryRunner.query(`
      CREATE TABLE "action_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "type" "action_token_type" NOT NULL,
        "token_hash" varchar NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "used_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_action_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "fk_action_tokens_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_action_tokens_user" ON "action_tokens" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_action_tokens_hash" ON "action_tokens" ("token_hash")`);

    // ---- vehicles ----
    await queryRunner.query(`
      CREATE TABLE "vehicles" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "driver_id" uuid NOT NULL,
        "type" "vehicle_type" NOT NULL,
        "capacity_kg" numeric,
        "reg_no" varchar NOT NULL,
        "photo_url" varchar,
        CONSTRAINT "pk_vehicles" PRIMARY KEY ("id"),
        CONSTRAINT "fk_vehicles_driver" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_vehicles_driver" ON "vehicles" ("driver_id")`);

    // ---- jobs ----
    await queryRunner.query(`
      CREATE TABLE "jobs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "owner_id" uuid NOT NULL,
        "pickup" varchar NOT NULL,
        "pickup_location" geography(Point,4326),
        "drop_off" varchar NOT NULL,
        "drop_off_location" geography(Point,4326),
        "cargo_type" varchar NOT NULL,
        "size" "job_size" NOT NULL,
        "weight_kg" numeric,
        "suggested_price" integer,
        "price" integer,
        "req_vehicle_type" "vehicle_type" NOT NULL,
        "status" "job_status" NOT NULL DEFAULT 'draft',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "posted_at" timestamptz,
        "matched_at" timestamptz,
        "accepted_at" timestamptz,
        "in_progress_at" timestamptz,
        "completed_at" timestamptz,
        "cancelled_at" timestamptz,
        CONSTRAINT "pk_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "fk_jobs_owner" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_jobs_owner" ON "jobs" ("owner_id")`);
    await queryRunner.query(`CREATE INDEX "idx_jobs_status" ON "jobs" ("status")`);

    // ---- proposals ----
    await queryRunner.query(`
      CREATE TABLE "proposals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "job_id" uuid NOT NULL,
        "driver_id" uuid NOT NULL,
        "status" "proposal_status" NOT NULL DEFAULT 'sent',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "responded_at" timestamptz,
        CONSTRAINT "pk_proposals" PRIMARY KEY ("id"),
        CONSTRAINT "fk_proposals_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_proposals_driver" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_proposals_job" ON "proposals" ("job_id")`);
    await queryRunner.query(`CREATE INDEX "idx_proposals_driver" ON "proposals" ("driver_id")`);

    // ---- messages ----
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "job_id" uuid NOT NULL,
        "sender_id" uuid NOT NULL,
        "receiver_id" uuid NOT NULL,
        "content" text NOT NULL,
        "sent_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_messages" PRIMARY KEY ("id"),
        CONSTRAINT "fk_messages_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_messages_sender" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_messages_receiver" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_messages_job" ON "messages" ("job_id")`);

    // ---- ratings ----
    await queryRunner.query(`
      CREATE TABLE "ratings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "job_id" uuid NOT NULL,
        "from_user_id" uuid NOT NULL,
        "to_user_id" uuid NOT NULL,
        "score" smallint NOT NULL,
        "comment" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_ratings" PRIMARY KEY ("id"),
        CONSTRAINT "uq_rating_job_from" UNIQUE ("job_id","from_user_id"),
        CONSTRAINT "chk_rating_score" CHECK ("score" >= 1 AND "score" <= 5),
        CONSTRAINT "fk_ratings_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_ratings_from" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_ratings_to" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_ratings_job" ON "ratings" ("job_id")`);
    await queryRunner.query(`CREATE INDEX "idx_ratings_to_user" ON "ratings" ("to_user_id")`);

    // ---- verification_records ----
    await queryRunner.query(`
      CREATE TABLE "verification_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "driver_id" uuid NOT NULL,
        "document_type" "document_type" NOT NULL,
        "storage_reference" varchar NOT NULL,
        "status" "verification_status" NOT NULL DEFAULT 'pending',
        "reviewed_by" uuid,
        "reviewed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_verification_records" PRIMARY KEY ("id"),
        CONSTRAINT "fk_verification_driver" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_verification_reviewer" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_verification_driver" ON "verification_records" ("driver_id")`);
    await queryRunner.query(`CREATE INDEX "idx_verification_status" ON "verification_records" ("status")`);

    // ---- pricing_config ----
    await queryRunner.query(`
      CREATE TABLE "pricing_config" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "vehicle_type" "vehicle_type" NOT NULL,
        "base_fare" integer NOT NULL,
        "rate_per_km" integer NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_pricing_config" PRIMARY KEY ("id"),
        CONSTRAINT "uq_pricing_vehicle_type" UNIQUE ("vehicle_type")
      )
    `);

    // ---- size_multipliers ----
    await queryRunner.query(`
      CREATE TABLE "size_multipliers" (
        "size" "job_size" NOT NULL,
        "multiplier" numeric(4,2) NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_size_multipliers" PRIMARY KEY ("size")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "size_multipliers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pricing_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verification_records"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ratings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "proposals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "vehicles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "action_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "action_token_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "verification_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "proposal_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "job_size"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "job_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "vehicle_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "availability_status"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role"`);
  }
}
