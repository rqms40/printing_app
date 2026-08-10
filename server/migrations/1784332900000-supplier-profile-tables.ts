import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

/**
 * Marketplace Phase 1 Task 1.2:
 * supplier_profiles, supplier_capabilities, supplier_verifications.
 */
export class SupplierProfileTables1784332900000 implements MigrationInterface {
  name = 'SupplierProfileTables1784332900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.supplier_verifications_status_enum') IS NULL THEN
          CREATE TYPE "public"."supplier_verifications_status_enum" AS ENUM (
            'pending',
            'under_review',
            'verified',
            'rejected'
          );
        END IF;
      END $$;
    `);

    if (!(await queryRunner.hasTable('supplier_profiles'))) {
      await queryRunner.query(`
        CREATE TABLE "supplier_profiles" (
          "id" SERIAL NOT NULL,
          "user_id" integer NOT NULL,
          "business_name" character varying(200) NOT NULL,
          "service_zones" jsonb NOT NULL DEFAULT '[]',
          "is_active" boolean NOT NULL DEFAULT true,
          "rating_average" numeric(3,2) NOT NULL DEFAULT 0,
          "rating_count" integer NOT NULL DEFAULT 0,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_supplier_profiles" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_supplier_profiles_user_id" UNIQUE ("user_id"),
          CONSTRAINT "FK_supplier_profiles_user_id"
            FOREIGN KEY ("user_id") REFERENCES "users"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "idx_supplier_profiles_user_id"
          ON "supplier_profiles" ("user_id")
      `);
    }

    if (!(await queryRunner.hasTable('supplier_capabilities'))) {
      await queryRunner.query(`
        CREATE TABLE "supplier_capabilities" (
          "id" SERIAL NOT NULL,
          "supplier_id" integer NOT NULL,
          "product_family" character varying(80) NOT NULL,
          "materials" jsonb NOT NULL DEFAULT '[]',
          "max_capacity" integer NOT NULL DEFAULT 0,
          "lead_time_days" integer NOT NULL DEFAULT 1,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_supplier_capabilities" PRIMARY KEY ("id"),
          CONSTRAINT "FK_supplier_capabilities_supplier_id"
            FOREIGN KEY ("supplier_id") REFERENCES "supplier_profiles"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_supplier_capabilities_supplier_id"
          ON "supplier_capabilities" ("supplier_id")
      `);
    }

    if (!(await queryRunner.hasTable('supplier_verifications'))) {
      await queryRunner.query(`
        CREATE TABLE "supplier_verifications" (
          "id" SERIAL NOT NULL,
          "supplier_id" integer NOT NULL,
          "status" "public"."supplier_verifications_status_enum"
            NOT NULL DEFAULT 'pending',
          "payout_details_ref" character varying(255),
          "reviewed_by" integer,
          "reviewed_at" TIMESTAMPTZ,
          "notes" text,
          "created_at" TIMESTAMP NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_supplier_verifications" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_supplier_verifications_supplier_id" UNIQUE ("supplier_id"),
          CONSTRAINT "FK_supplier_verifications_supplier_id"
            FOREIGN KEY ("supplier_id") REFERENCES "supplier_profiles"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_supplier_verifications_reviewed_by"
            FOREIGN KEY ("reviewed_by") REFERENCES "users"("id")
            ON DELETE NO ACTION ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX "idx_supplier_verifications_supplier_id"
          ON "supplier_verifications" ("supplier_id")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_verifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_capabilities"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_profiles"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."supplier_verifications_status_enum"`,
    );
  }
}
