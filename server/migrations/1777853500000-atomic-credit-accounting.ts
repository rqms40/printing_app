import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

export class AtomicCreditAccounting1777853500000 implements MigrationInterface {
  name = 'AtomicCreditAccounting1777853500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCreditTransactions =
      (await queryRunner.hasTable('credit_transactions')) &&
      (await queryRunner.hasColumn('credit_transactions', 'reference_id'));
    const hasBetaUsers =
      (await queryRunner.hasTable('users')) &&
      (await queryRunner.hasColumn('users', 'beta_credits_granted'));

    if (hasCreditTransactions && hasBetaUsers) {
      await queryRunner.query(`
        UPDATE credit_transactions AS transaction_record
        SET reference_id = NULL
        WHERE reference_id LIKE 'BETA-ENROLLMENT:%'
          AND (
            reference_id <>
              'BETA-ENROLLMENT:' || transaction_record.user_id::text
            OR transaction_record.type::text <> 'top_up'
            OR transaction_record.status::text <> 'approved'
            OR transaction_record."amountCredits" <> 100
            OR NOT EXISTS (
              SELECT 1
              FROM users AS referenced_user
              WHERE referenced_user.id = transaction_record.user_id
            )
          )
      `);
      await queryRunner.query(`
        WITH ranked_beta_references AS (
          SELECT id,
                 ROW_NUMBER() OVER (
                   PARTITION BY reference_id
                   ORDER BY id
                 ) AS occurrence
          FROM credit_transactions
          WHERE reference_id LIKE 'BETA-ENROLLMENT:%'
        )
        UPDATE credit_transactions AS transaction_record
        SET reference_id = NULL
        FROM ranked_beta_references AS ranked
        WHERE transaction_record.id = ranked.id
          AND ranked.occurrence > 1
      `);
      await queryRunner.query(`
        INSERT INTO credit_transactions (
          user_id,
          type,
          "amountCredits",
          status,
          reference_id
        )
        SELECT beta_user.id,
               'top_up'::credit_transactions_type_enum,
               100,
               'approved'::credit_transactions_status_enum,
               'BETA-ENROLLMENT:' || beta_user.id::text
        FROM users AS beta_user
        WHERE beta_user.beta_credits_granted = true
          AND NOT EXISTS (
            SELECT 1
            FROM credit_transactions AS existing_grant
            WHERE existing_grant.reference_id =
              'BETA-ENROLLMENT:' || beta_user.id::text
              AND existing_grant.user_id = beta_user.id
              AND existing_grant.type::text = 'top_up'
              AND existing_grant.status::text = 'approved'
              AND existing_grant."amountCredits" = 100
          )
      `);
      await queryRunner.query(`
        UPDATE users AS beta_user
        SET beta_credits_granted = true
        WHERE beta_user.beta_credits_granted = false
          AND EXISTS (
            SELECT 1
            FROM credit_transactions AS existing_grant
            WHERE existing_grant.reference_id =
              'BETA-ENROLLMENT:' || beta_user.id::text
              AND existing_grant.user_id = beta_user.id
              AND existing_grant.type::text = 'top_up'
              AND existing_grant.status::text = 'approved'
              AND existing_grant."amountCredits" = 100
          )
      `);
    }

    if (hasCreditTransactions) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS
          uq_credit_transactions_refund_reference
        ON credit_transactions (reference_id)
        WHERE reference_id LIKE 'ORDER-REFUND:%'
           OR reference_id LIKE 'BATCH-REFUND:%'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_credit_transactions_refund_reference
    `);
  }
}
