import { MigrationInterface, QueryRunner } from 'typeorm';

export class DynamicProductCatalog1777680000000 implements MigrationInterface {
  name = 'DynamicProductCatalog1777680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "paper_specs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "three_d_specs" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "spec_options" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "service_categories" CASCADE`);

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

    await queryRunner.query(
      `ALTER TABLE "service_addons" DROP CONSTRAINT IF EXISTS "FK_service_addons_category"`,
    );
    await queryRunner.query(
      `ALTER TABLE "service_addons" ADD CONSTRAINT "FK_service_addons_product_category" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "category_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "category_slug" varchar(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "category_name" varchar(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "pricing_model" varchar(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "order_item_spec_values"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_spec_options"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_spec_definitions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_categories"`);
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "pricing_model"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "category_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "category_slug"`,
    );
    await queryRunner.query(
      `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "category_id"`,
    );
  }
}
