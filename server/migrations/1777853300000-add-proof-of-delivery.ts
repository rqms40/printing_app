import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProofOfDelivery1777853300000 implements MigrationInterface {
  name = 'AddProofOfDelivery1777853300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_proof_type_enum') THEN
          CREATE TYPE "delivery_proof_type_enum" AS ENUM ('photo', 'signature');
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "delivery_assignments"
      ADD COLUMN IF NOT EXISTS "proof_type" "delivery_proof_type_enum",
      ADD COLUMN IF NOT EXISTS "proof_file_id" int,
      ADD COLUMN IF NOT EXISTS "proof_object_key" varchar,
      ADD COLUMN IF NOT EXISTS "proof_signature_data" text,
      ADD COLUMN IF NOT EXISTS "proof_captured_at" timestamp,
      ADD COLUMN IF NOT EXISTS "proof_captured_by_rider_id" int
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_assignments"
      DROP COLUMN IF EXISTS "proof_captured_by_rider_id",
      DROP COLUMN IF EXISTS "proof_captured_at",
      DROP COLUMN IF EXISTS "proof_signature_data",
      DROP COLUMN IF EXISTS "proof_object_key",
      DROP COLUMN IF EXISTS "proof_file_id",
      DROP COLUMN IF EXISTS "proof_type"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "delivery_proof_type_enum"
    `);
  }
}
