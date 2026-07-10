import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

const EVIDENCE_REFERENCES = [
  {
    table: 'delivery_assignments',
    column: 'proof_file_id',
    constraint: 'FK_delivery_assignments_proof_file',
  },
  {
    table: 'users',
    column: 'beta_photo_file_id',
    constraint: 'FK_users_beta_photo_file',
  },
  {
    table: 'orders',
    column: 'file_metadata_id',
    constraint: 'FK_orders_file_metadata',
  },
  {
    table: 'order_items',
    column: 'file_metadata_id',
    constraint: 'FK_order_items_file_metadata',
  },
] as const;

export class EvidenceFileIntegrity1777853800000
  implements MigrationInterface
{
  name = 'EvidenceFileIntegrity1777853800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('file_metadata'))) return;

    for (const reference of EVIDENCE_REFERENCES) {
      if (
        !(await queryRunner.hasTable(reference.table)) ||
        !(await queryRunner.hasColumn(reference.table, reference.column))
      ) {
        continue;
      }

      await queryRunner.query(`
        UPDATE "${reference.table}" AS referencing_row
        SET "${reference.column}" = NULL
        WHERE referencing_row."${reference.column}" IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM "file_metadata" AS file_record
            WHERE file_record."id" = referencing_row."${reference.column}"
          )
      `);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = '${reference.constraint}'
              AND conrelid = '"${reference.table}"'::regclass
          ) THEN
            ALTER TABLE "${reference.table}"
            ADD CONSTRAINT "${reference.constraint}"
            FOREIGN KEY ("${reference.column}")
            REFERENCES "file_metadata"("id")
            ON DELETE RESTRICT;
          END IF;
        END
        $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    for (const reference of [...EVIDENCE_REFERENCES].reverse()) {
      if (!(await queryRunner.hasTable(reference.table))) continue;
      await queryRunner.query(`
        ALTER TABLE "${reference.table}"
        DROP CONSTRAINT IF EXISTS "${reference.constraint}"
      `);
    }
  }
}
