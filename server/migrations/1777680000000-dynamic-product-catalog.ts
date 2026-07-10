import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

export class DynamicProductCatalog1777680000000 implements MigrationInterface {
  name = 'DynamicProductCatalog1777680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('product_categories'))) {
      await queryRunner.query(`
        CREATE TABLE "product_categories" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar(100) NOT NULL,
        "slug" varchar(50) NOT NULL UNIQUE,
        "description" text,
        "mobile_description" varchar(160),
        "icon" varchar(50),
        "file_processing_type" varchar(30) NOT NULL DEFAULT 'generic_file',
        "pricing_model" varchar(50) NOT NULL,
        "base_rate" numeric(10,2) NOT NULL,
        "quantity_unit" varchar(30) NOT NULL DEFAULT 'copy',
        "max_file_size_mb" integer NOT NULL DEFAULT 50,
        "allowed_extensions" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
      `);
    }

    if (!(await queryRunner.hasTable('product_spec_definitions'))) {
      await queryRunner.query(`
        CREATE TABLE "product_spec_definitions" (
        "id" SERIAL PRIMARY KEY,
        "category_id" integer NOT NULL REFERENCES "product_categories"("id") ON DELETE CASCADE,
        "key" varchar(50) NOT NULL,
        "label" varchar(100) NOT NULL,
        "help_text" text,
        "input_type" varchar(30) NOT NULL,
        "value_type" varchar(30) NOT NULL,
        "is_required" boolean NOT NULL DEFAULT true,
        "is_active" boolean NOT NULL DEFAULT true,
        "default_value" varchar(100),
        "pricing_role" varchar(40) NOT NULL DEFAULT 'none',
        "unit_label" varchar(20),
        "placeholder" varchar(120),
        "min_value" numeric(10,3),
        "max_value" numeric(10,3),
        "step_value" numeric(10,3),
        "sort_order" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "uq_product_spec_key" UNIQUE ("category_id", "key")
      )
      `);
    }

    if (!(await queryRunner.hasTable('product_spec_options'))) {
      await queryRunner.query(`
        CREATE TABLE "product_spec_options" (
        "id" SERIAL PRIMARY KEY,
        "spec_definition_id" integer NOT NULL REFERENCES "product_spec_definitions"("id") ON DELETE CASCADE,
        "label" varchar(100) NOT NULL,
        "value" varchar(50) NOT NULL,
        "multiplier" numeric(8,3) NOT NULL DEFAULT 1,
        "fixed_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "unit_cost" numeric(10,2) NOT NULL DEFAULT 0,
        "estimated_quantity" numeric(10,2),
        "is_default" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "sort_order" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "uq_product_spec_option_value" UNIQUE ("spec_definition_id", "value")
      )
      `);
    }

    if (!(await queryRunner.hasTable('order_item_spec_values'))) {
      await queryRunner.query(`
        CREATE TABLE "order_item_spec_values" (
        "id" SERIAL PRIMARY KEY,
        "order_item_id" integer NOT NULL REFERENCES "order_items"("id") ON DELETE CASCADE,
        "spec_definition_id" integer,
        "spec_key" varchar(50) NOT NULL,
        "spec_label" varchar(100) NOT NULL,
        "input_type" varchar(30) NOT NULL,
        "value" varchar(120) NOT NULL,
        "display_value" varchar(120) NOT NULL,
        "option_id" integer,
        "option_label" varchar(100),
        "multiplier" numeric(8,3) NOT NULL DEFAULT 1,
        "fixed_fee" numeric(10,2) NOT NULL DEFAULT 0,
        "unit_cost" numeric(10,2) NOT NULL DEFAULT 0,
        "estimated_quantity" numeric(10,2)
      )
      `);
    }

    if (
      (await queryRunner.hasTable('service_categories')) &&
      (await queryRunner.hasTable('product_categories'))
    ) {
      await queryRunner.query(`
        INSERT INTO "product_categories" (
          "name",
          "slug",
          "description",
          "mobile_description",
          "icon",
          "file_processing_type",
          "pricing_model",
          "base_rate",
          "quantity_unit",
          "max_file_size_mb",
          "allowed_extensions",
          "is_active",
          "sort_order",
          "created_at",
          "updated_at"
        )
        SELECT
          legacy_category."name",
          legacy_category."slug",
          legacy_category."description",
          left(legacy_category."description", 160),
          legacy_category."icon",
          CASE
            WHEN lower(legacy_category."slug") LIKE '%3d%'
              OR lower(legacy_category."name") LIKE '%3d%'
            THEN 'model_3d'
            ELSE 'document'
          END,
          CASE
            WHEN lower(legacy_category."slug") LIKE '%3d%'
              OR lower(legacy_category."name") LIKE '%3d%'
            THEN 'base_plus_material_estimate'
            ELSE 'per_page_modifiers'
          END,
          legacy_category."base_rate",
          CASE
            WHEN lower(legacy_category."slug") LIKE '%3d%'
              OR lower(legacy_category."name") LIKE '%3d%'
            THEN 'model'
            ELSE 'copy'
          END,
          legacy_category."max_file_size_mb",
          CASE
            WHEN btrim(legacy_category."allowed_extensions") IN ('', '[]')
            THEN '[]'::jsonb
            ELSE to_jsonb(
              regexp_split_to_array(
                translate(legacy_category."allowed_extensions", '[]" ', ''),
                ','
              )
            )
          END,
          legacy_category."is_active",
          legacy_category."sort_order",
          legacy_category."created_at",
          legacy_category."updated_at"
        FROM "service_categories" legacy_category
        ON CONFLICT ("slug") DO UPDATE
        SET
          "description" = COALESCE(
            NULLIF("product_categories"."description", ''),
            EXCLUDED."description"
          ),
          "mobile_description" = COALESCE(
            NULLIF("product_categories"."mobile_description", ''),
            EXCLUDED."mobile_description"
          ),
          "icon" = COALESCE(
            NULLIF("product_categories"."icon", ''),
            EXCLUDED."icon"
          ),
          "allowed_extensions" = CASE
            WHEN "product_categories"."allowed_extensions" = '[]'::jsonb
            THEN EXCLUDED."allowed_extensions"
            ELSE "product_categories"."allowed_extensions"
          END
      `);
    }

    if (
      (await queryRunner.hasTable('service_addons')) &&
      (await queryRunner.hasTable('product_categories'))
    ) {
      await queryRunner.query(`
        DO $$
        DECLARE
          category_fk record;
          legacy_fk_present boolean := false;
        BEGIN
          FOR category_fk IN
            SELECT
              constraint_record.conname,
              constraint_record.confrelid =
                to_regclass('public.service_categories') AS references_legacy
            FROM pg_constraint constraint_record
            JOIN pg_attribute column_record
              ON column_record.attrelid = constraint_record.conrelid
             AND column_record.attnum = ANY (constraint_record.conkey)
            WHERE constraint_record.contype = 'f'
              AND constraint_record.conrelid =
                'public.service_addons'::regclass
              AND column_record.attname = 'category_id'
          LOOP
            legacy_fk_present :=
              legacy_fk_present OR category_fk.references_legacy;
            EXECUTE format(
              'ALTER TABLE service_addons DROP CONSTRAINT %I',
              category_fk.conname
            );
          END LOOP;

          IF legacy_fk_present THEN
            UPDATE "service_addons" addon
            SET "category_id" = product_category."id"
            FROM "service_categories" legacy_category
            JOIN "product_categories" product_category
              ON product_category."slug" = legacy_category."slug"
            WHERE addon."category_id" = legacy_category."id";
          END IF;

          IF EXISTS (
            SELECT 1
            FROM "service_addons" addon
            LEFT JOIN "product_categories" product_category
              ON product_category."id" = addon."category_id"
            WHERE addon."category_id" IS NOT NULL
              AND product_category."id" IS NULL
          ) THEN
            RAISE EXCEPTION
              'Cannot migrate service_addons.category_id: unmapped category';
          END IF;

          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint constraint_record
            JOIN pg_attribute column_record
              ON column_record.attrelid = constraint_record.conrelid
              AND column_record.attnum = ANY (constraint_record.conkey)
            WHERE constraint_record.contype = 'f'
              AND constraint_record.conrelid = 'public.service_addons'::regclass
              AND constraint_record.confrelid = 'public.product_categories'::regclass
              AND column_record.attname = 'category_id'
          ) THEN
            ALTER TABLE "service_addons"
            ADD CONSTRAINT "FK_service_addons_product_category"
            FOREIGN KEY ("category_id")
            REFERENCES "product_categories"("id")
            ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    }

    if (await queryRunner.hasTable('order_items')) {
      const columns = [
        ['category_id', 'integer'],
        ['category_slug', 'varchar(50)'],
        ['category_name', 'varchar(100)'],
        ['pricing_model', 'varchar(50)'],
      ] as const;
      for (const [column, type] of columns) {
        if (!(await queryRunner.hasColumn('order_items', column))) {
          await queryRunner.query(
            `ALTER TABLE "order_items" ADD COLUMN "${column}" ${type}`,
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    for (const table of [
      'order_item_spec_values',
      'product_spec_options',
      'product_spec_definitions',
      'product_categories',
    ]) {
      if (await queryRunner.hasTable(table)) {
        await queryRunner.query(`DROP TABLE "${table}" CASCADE`);
      }
    }
    if (await queryRunner.hasTable('order_items')) {
      for (const column of [
        'pricing_model',
        'category_name',
        'category_slug',
        'category_id',
      ]) {
        if (await queryRunner.hasColumn('order_items', column)) {
          await queryRunner.query(
            `ALTER TABLE "order_items" DROP COLUMN "${column}"`,
          );
        }
      }
    }
  }
}
