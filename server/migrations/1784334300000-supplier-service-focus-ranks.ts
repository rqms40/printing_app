import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ordered list of supplier service-focus keys (e.g. signages, tarpaulins).
 * Index 0 = highest priority.
 */
export class SupplierServiceFocusRanks1784334300000
  implements MigrationInterface
{
  name = 'SupplierServiceFocusRanks1784334300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "supplier_profiles"
        ADD COLUMN IF NOT EXISTS "service_focus_ranks" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "supplier_profiles"
        DROP COLUMN IF EXISTS "service_focus_ranks"
    `);
  }
}
