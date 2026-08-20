import { MigrationInterface, QueryRunner } from 'typeorm';

export class MatchingPreference1786516700000 implements MigrationInterface {
  name = 'MatchingPreference1786516700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'matching_preference_enum') THEN
          CREATE TYPE "public"."matching_preference_enum" AS ENUM('quality', 'price', 'speed');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN IF NOT EXISTS "matching_preference" "public"."matching_preference_enum" NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "orders"
        ADD COLUMN IF NOT EXISTS "preferred_supplier_id" integer NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "orders" DROP COLUMN IF EXISTS "preferred_supplier_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "matching_preference"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."matching_preference_enum"
    `);
  }
}
