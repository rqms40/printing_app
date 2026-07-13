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
      if (await queryRunner.hasTable('orders')) {
        await queryRunner.query(`
          WITH individual_refund_candidates AS (
            SELECT transaction_record.id,
                   'ORDER-REFUND:' || order_record.order_id AS canonical_ref
            FROM credit_transactions AS transaction_record
            JOIN orders AS order_record
              ON order_record.order_id = transaction_record.reference_id
            WHERE order_record.batch_order_id IS NULL
              AND transaction_record.user_id = order_record.user_id
              AND transaction_record.type::text = 'top_up'
              AND transaction_record.status::text = 'approved'
              AND transaction_record."amountCredits" =
                    order_record.total_price + order_record.delivery_fee
              AND transaction_record."amountPhp" IS NULL
              AND transaction_record.proof_of_payment_url IS NULL
              AND transaction_record.created_at >= order_record.created_at
              AND replace(replace(lower(order_record.payment_method), '_', ''), '-', '')
                    IN ('credits', 'gridcredits')
              AND (
                SELECT COUNT(*)
                FROM credit_transactions AS same_reference
                WHERE same_reference.reference_id = order_record.order_id
              ) = 1
              AND NOT EXISTS (
                SELECT 1
                FROM credit_transactions AS stable_refund
                WHERE stable_refund.reference_id =
                  'ORDER-REFUND:' || order_record.order_id
              )
          )
          UPDATE credit_transactions AS transaction_record
          SET reference_id = candidate.canonical_ref
          FROM individual_refund_candidates AS candidate
          WHERE transaction_record.id = candidate.id
        `);
      }

      if (
        (await queryRunner.hasTable('orders')) &&
        (await queryRunner.hasTable('batch_orders'))
      ) {
        await queryRunner.query(`
          WITH batch_refund_candidates AS (
            SELECT transaction_record.id,
                   'BATCH-REFUND:' || batch_record.batch_ref AS canonical_ref
            FROM credit_transactions AS transaction_record
            JOIN orders AS order_record
              ON order_record.order_id = transaction_record.reference_id
            JOIN batch_orders AS batch_record
              ON batch_record.id = order_record.batch_order_id
            WHERE transaction_record.user_id = batch_record.user_id
              AND transaction_record.type::text = 'top_up'
              AND transaction_record.status::text = 'approved'
              AND transaction_record."amountCredits" =
                    batch_record.subtotal + batch_record.delivery_fee +
                    batch_record.priority_fee +
                    batch_record.extra_destination_fee
              AND transaction_record."amountPhp" IS NULL
              AND transaction_record.proof_of_payment_url IS NULL
              AND transaction_record.created_at >= order_record.created_at
              AND replace(replace(lower(batch_record.payment_method), '_', ''), '-', '')
                    IN ('credits', 'gridcredits')
              AND (
                SELECT COUNT(*)
                FROM credit_transactions AS batch_reference
                JOIN orders AS referenced_order
                  ON referenced_order.order_id = batch_reference.reference_id
                WHERE referenced_order.batch_order_id = batch_record.id
              ) = 1
              AND NOT EXISTS (
                SELECT 1
                FROM credit_transactions AS stable_refund
                WHERE stable_refund.reference_id =
                  'BATCH-REFUND:' || batch_record.batch_ref
              )
          )
          UPDATE credit_transactions AS transaction_record
          SET reference_id = candidate.canonical_ref
          FROM batch_refund_candidates AS candidate
          WHERE transaction_record.id = candidate.id
        `);
      }

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
