import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierCatalogOfferings1787228300000
  implements MigrationInterface
{
  name = 'AddSupplierCatalogOfferings1787228300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "supplier_catalog_offerings" (
        "id" SERIAL PRIMARY KEY,
        "supplier_id" integer NOT NULL,
        "title" varchar(160) NOT NULL,
        "category_slugs" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "spec_options" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "addons" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "notes" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "base_rate_pesos" numeric(10,2) NULL,
        "pricing_unit" varchar(40) NULL,
        "source" varchar(20) NOT NULL DEFAULT 'manual',
        "source_file_name" varchar(255) NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "uq_supplier_catalog_offering_title" UNIQUE ("supplier_id", "title"),
        CONSTRAINT "fk_supplier_catalog_offerings_supplier"
          FOREIGN KEY ("supplier_id") REFERENCES "supplier_profiles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_supplier_catalog_offerings_supplier_id"
        ON "supplier_catalog_offerings" ("supplier_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "supplier_catalog_offerings"`,
    );
  }
}
