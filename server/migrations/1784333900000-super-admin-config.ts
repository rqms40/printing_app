import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 8 Super Admin configuration:
 * - rider verification columns
 * - geo_zones (simplified Davao polygons)
 * - platform_commerce_settings (fees + commission)
 */
export class SuperAdminConfig1784333900000 implements MigrationInterface {
  name = 'SuperAdminConfig1784333900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.rider_verification_status_enum') IS NULL THEN
          CREATE TYPE "public"."rider_verification_status_enum" AS ENUM (
            'pending',
            'under_review',
            'verified',
            'rejected'
          );
        END IF;
      END $$;
    `);

    // Existing riders default to verified so ops continuity is preserved.
    if (await queryRunner.hasTable('rider_profiles')) {
      const hasCol = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'rider_profiles'
          AND column_name = 'verification_status'
        LIMIT 1
      `);
      if (!Array.isArray(hasCol) || hasCol.length === 0) {
        await queryRunner.query(`
          ALTER TABLE "rider_profiles"
          ADD COLUMN "verification_status"
            "public"."rider_verification_status_enum"
            NOT NULL DEFAULT 'verified',
          ADD COLUMN "verification_notes" text,
          ADD COLUMN "verification_reviewed_by" integer,
          ADD COLUMN "verification_reviewed_at" TIMESTAMPTZ
        `);
        await queryRunner.query(`
          ALTER TABLE "rider_profiles"
          ADD CONSTRAINT "FK_rider_profiles_verification_reviewed_by"
            FOREIGN KEY ("verification_reviewed_by")
            REFERENCES "users"("id")
            ON DELETE SET NULL
        `);
      }
    }

    if (!(await queryRunner.hasTable('geo_zones'))) {
      await queryRunner.query(`
        CREATE TABLE "geo_zones" (
          "id" SERIAL NOT NULL,
          "name" character varying(120) NOT NULL,
          "code" character varying(40) NOT NULL,
          "polygon" jsonb NOT NULL,
          "base_delivery_fee_minor" bigint NOT NULL DEFAULT 2500,
          "is_active" boolean NOT NULL DEFAULT true,
          "sort_order" integer NOT NULL DEFAULT 0,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PK_geo_zones" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_geo_zones_code" UNIQUE ("code")
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_geo_zones_is_active" ON "geo_zones" ("is_active")
      `);
    }

    if (!(await queryRunner.hasTable('platform_commerce_settings'))) {
      await queryRunner.query(`
        CREATE TABLE "platform_commerce_settings" (
          "id" integer NOT NULL,
          "default_commission_bps" integer NOT NULL DEFAULT 1500,
          "default_delivery_fee_minor" bigint NOT NULL DEFAULT 2500,
          "reject_outside_zones" boolean NOT NULL DEFAULT true,
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PK_platform_commerce_settings" PRIMARY KEY ("id")
        )
      `);
      await queryRunner.query(`
        INSERT INTO "platform_commerce_settings"
          ("id", "default_commission_bps", "default_delivery_fee_minor", "reject_outside_zones")
        VALUES (1, 1500, 2500, true)
        ON CONFLICT ("id") DO NOTHING
      `);
    }

    // Simplified Davao City / Metro Davao bounding polygons (closed rings [lng, lat]).
    const davaoCity = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [125.45, 7.0],
          [125.75, 7.0],
          [125.75, 7.2],
          [125.45, 7.2],
          [125.45, 7.0],
        ],
      ],
    });
    const toril = JSON.stringify({
      type: 'Polygon',
      coordinates: [
        [
          [125.45, 6.95],
          [125.6, 6.95],
          [125.6, 7.05],
          [125.45, 7.05],
          [125.45, 6.95],
        ],
      ],
    });

    await queryRunner.query(
      `
      INSERT INTO "geo_zones"
        ("name", "code", "polygon", "base_delivery_fee_minor", "is_active", "sort_order")
      VALUES
        ('Davao City Core', 'davao_city_core', $1::jsonb, 2500, true, 1),
        ('Toril', 'toril', $2::jsonb, 3500, true, 2)
      ON CONFLICT ("code") DO NOTHING
      `,
      [davaoCity, toril],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('geo_zones')) {
      await queryRunner.query(`DROP TABLE "geo_zones"`);
    }
    if (await queryRunner.hasTable('platform_commerce_settings')) {
      await queryRunner.query(`DROP TABLE "platform_commerce_settings"`);
    }
    if (await queryRunner.hasTable('rider_profiles')) {
      await queryRunner.query(`
        ALTER TABLE "rider_profiles"
        DROP CONSTRAINT IF EXISTS "FK_rider_profiles_verification_reviewed_by"
      `);
      await queryRunner.query(`
        ALTER TABLE "rider_profiles"
        DROP COLUMN IF EXISTS "verification_reviewed_at",
        DROP COLUMN IF EXISTS "verification_reviewed_by",
        DROP COLUMN IF EXISTS "verification_notes",
        DROP COLUMN IF EXISTS "verification_status"
      `);
    }
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."rider_verification_status_enum"
    `);
  }
}
