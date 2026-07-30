import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

const BETA_REFERENCE_PATTERN = 'BETA-ENROLLMENT:%';

export class BetaCreditLedgerAndRankIndex1777853400000 implements MigrationInterface {
  name = 'BetaCreditLedgerAndRankIndex1777853400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('credit_transactions')) &&
      (await queryRunner.hasColumn('credit_transactions', 'reference_id'))
    ) {
      await queryRunner.query(`
        WITH ranked_beta_references AS (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY reference_id
                   ORDER BY
                     CASE
                       WHEN reference_id =
                              'BETA-ENROLLMENT:' || user_id::text
                        AND type::text = 'top_up'
                        AND status::text = 'approved'
                        AND "amountCredits" = 100
                       THEN 0
                       ELSE 1
                     END,
                     id
                 ) AS occurrence
          FROM credit_transactions
          WHERE reference_id LIKE '${BETA_REFERENCE_PATTERN}'
        )
        UPDATE credit_transactions AS transaction_record
        SET reference_id = NULL
        FROM ranked_beta_references AS ranked
        WHERE transaction_record.id = ranked.id
          AND ranked.occurrence > 1
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS
          uq_credit_transactions_beta_enrollment_reference
        ON credit_transactions (reference_id)
        WHERE reference_id LIKE '${BETA_REFERENCE_PATTERN}'
      `);
    }

    if (
      (await queryRunner.hasTable('users')) &&
      (await queryRunner.hasColumn('users', 'is_beta_user')) &&
      (await queryRunner.hasColumn('users', 'beta_enrolled_at')) &&
      (await queryRunner.hasColumn('users', 'id'))
    ) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_users_beta_enrollment_rank
        ON users (beta_enrolled_at, id)
        WHERE is_beta_user = true
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_credit_transactions_beta_enrollment_reference
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_users_beta_enrollment_rank
    `);
  }
}
