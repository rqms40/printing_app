import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marketplace rider pickup map:
 * - supplier_profiles lat/lng shop pin
 * - dispatch_plan_stops.kind (pickup | dropoff) so one assignment can
 *   persist supplier pickup then customer delivery
 */
export class SupplierPickupMap1786516600000 implements MigrationInterface {
  name = 'SupplierPickupMap1786516600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "supplier_profiles"
        ADD COLUMN IF NOT EXISTS "latitude" numeric(10,7) NULL,
        ADD COLUMN IF NOT EXISTS "longitude" numeric(10,7) NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CHK_supplier_profiles_location'
        ) THEN
          ALTER TABLE "supplier_profiles"
            ADD CONSTRAINT "CHK_supplier_profiles_location"
            CHECK (
              ("latitude" IS NULL AND "longitude" IS NULL)
              OR (
                "latitude" IS NOT NULL
                AND "longitude" IS NOT NULL
                AND "latitude" BETWEEN -90 AND 90
                AND "longitude" BETWEEN -180 AND 180
                AND NOT ("latitude" = 0 AND "longitude" = 0)
              )
            );
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.dispatch_stop_kind_enum') IS NULL THEN
          CREATE TYPE "public"."dispatch_stop_kind_enum" AS ENUM (
            'pickup',
            'dropoff'
          );
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "dispatch_plan_stops"
        ADD COLUMN IF NOT EXISTS "kind" "public"."dispatch_stop_kind_enum"
        NOT NULL DEFAULT 'dropoff'
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_dispatch_plan_stops_assignment"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_dispatch_plan_stops_assignment_kind"
        ON "dispatch_plan_stops" ("plan_id", "assignment_id", "kind")
    `);

    // Existing seed shop (Davao Print Co) gets a pin so rider assign works
    // without forcing a profile re-save.
    await queryRunner.query(`
      UPDATE "supplier_profiles" sp
      SET "latitude" = 7.0505,
          "longitude" = 125.5889
      FROM "users" u
      WHERE sp."user_id" = u."id"
        AND u."email" = 'supplier@gridgo.ph'
        AND sp."latitude" IS NULL
        AND sp."longitude" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_dispatch_plan_stops_assignment_kind"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_dispatch_plan_stops_assignment"
        ON "dispatch_plan_stops" ("plan_id", "assignment_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "dispatch_plan_stops" DROP COLUMN IF EXISTS "kind"
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."dispatch_stop_kind_enum"
    `);
    await queryRunner.query(`
      ALTER TABLE "supplier_profiles"
        DROP CONSTRAINT IF EXISTS "CHK_supplier_profiles_location"
    `);
    await queryRunner.query(`
      ALTER TABLE "supplier_profiles"
        DROP COLUMN IF EXISTS "longitude",
        DROP COLUMN IF EXISTS "latitude"
    `);
  }
}
