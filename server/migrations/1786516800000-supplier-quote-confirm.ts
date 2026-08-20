import { MigrationInterface, QueryRunner } from 'typeorm';

export class SupplierQuoteConfirm1786516800000 implements MigrationInterface {
  name = 'SupplierQuoteConfirm1786516800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "supplier_assignments"
        ADD COLUMN IF NOT EXISTS "quoted_price_minor" bigint NULL,
        ADD COLUMN IF NOT EXISTS "quoted_promised_date" TIMESTAMPTZ NULL,
        ADD COLUMN IF NOT EXISTS "customer_confirmed_quote_at" TIMESTAMPTZ NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "supplier_assignments"
        DROP COLUMN IF EXISTS "customer_confirmed_quote_at",
        DROP COLUMN IF EXISTS "quoted_promised_date",
        DROP COLUMN IF EXISTS "quoted_price_minor"
    `);
  }
}
