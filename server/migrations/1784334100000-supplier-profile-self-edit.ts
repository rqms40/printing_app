import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Supplier-editable profile fields: description, contact, address, logo, attributes.
 */
export class SupplierProfileSelfEdit1784334100000
  implements MigrationInterface
{
  name = 'SupplierProfileSelfEdit1784334100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "supplier_profiles"
        ADD COLUMN IF NOT EXISTS "description" text NULL,
        ADD COLUMN IF NOT EXISTS "contact_phone" varchar(40) NULL,
        ADD COLUMN IF NOT EXISTS "contact_email" varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS "address" text NULL,
        ADD COLUMN IF NOT EXISTS "logo_file_id" int NULL,
        ADD COLUMN IF NOT EXISTS "attributes" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);

    // Optional FK to file_metadata when table exists
    const files = await queryRunner.query(
      `SELECT to_regclass('public.file_metadata') AS reg`,
    );
    if (files[0]?.reg) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_supplier_profiles_logo_file'
          ) THEN
            ALTER TABLE "supplier_profiles"
              ADD CONSTRAINT "fk_supplier_profiles_logo_file"
              FOREIGN KEY ("logo_file_id") REFERENCES "file_metadata"("id")
              ON DELETE SET NULL;
          END IF;
        END $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "supplier_profiles"
        DROP CONSTRAINT IF EXISTS "fk_supplier_profiles_logo_file"
    `);
    await queryRunner.query(`
      ALTER TABLE "supplier_profiles"
        DROP COLUMN IF EXISTS "attributes",
        DROP COLUMN IF EXISTS "logo_file_id",
        DROP COLUMN IF EXISTS "address",
        DROP COLUMN IF EXISTS "contact_email",
        DROP COLUMN IF EXISTS "contact_phone",
        DROP COLUMN IF EXISTS "description"
    `);
  }
}
