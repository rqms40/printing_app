import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persist supplier self-QC evidence file ids on the assignment so clients
 * can display the photo under supplier_self_qc.
 */
export class SupplierAssignmentSelfQcEvidence1784334200000
  implements MigrationInterface
{
  name = 'SupplierAssignmentSelfQcEvidence1784334200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "supplier_assignments"
        ADD COLUMN IF NOT EXISTS "self_qc_evidence_file_ids" jsonb NOT NULL DEFAULT '[]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "supplier_assignments"
        DROP COLUMN IF EXISTS "self_qc_evidence_file_ids"
    `);
  }
}
