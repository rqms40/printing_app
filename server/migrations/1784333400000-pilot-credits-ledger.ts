import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

/**
 * Marketplace Phase 3 Task 3.1: Pilot Credits ledger semantics.
 *
 * - Expand credit_transactions_type_enum with grant/reserve/spend/release/expire/manual_adjustment
 * - Ledger audit columns: reason, expires_at, idempotency_key, actor_user_id, balances
 * - Unique partial index on idempotency_key for reserve/spend
 */
export class PilotCreditsLedger1784333400000 implements MigrationInterface {
  name = 'PilotCreditsLedger1784333400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('credit_transactions'))) {
      return;
    }

    // Expand enum (Postgres allows ADD VALUE; IF NOT EXISTS from PG 9.1+ via DO block)
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.credit_transactions_type_enum') IS NOT NULL THEN
          ALTER TYPE "public"."credit_transactions_type_enum" ADD VALUE IF NOT EXISTS 'grant';
          ALTER TYPE "public"."credit_transactions_type_enum" ADD VALUE IF NOT EXISTS 'reserve';
          ALTER TYPE "public"."credit_transactions_type_enum" ADD VALUE IF NOT EXISTS 'spend';
          ALTER TYPE "public"."credit_transactions_type_enum" ADD VALUE IF NOT EXISTS 'release';
          ALTER TYPE "public"."credit_transactions_type_enum" ADD VALUE IF NOT EXISTS 'expire';
          ALTER TYPE "public"."credit_transactions_type_enum" ADD VALUE IF NOT EXISTS 'manual_adjustment';
        END IF;
      END $$;
    `);

    if (!(await queryRunner.hasColumn('credit_transactions', 'idempotency_key'))) {
      await queryRunner.query(`
        ALTER TABLE "credit_transactions"
        ADD COLUMN "idempotency_key" character varying
      `);
    }

    if (!(await queryRunner.hasColumn('credit_transactions', 'reason'))) {
      await queryRunner.query(`
        ALTER TABLE "credit_transactions"
        ADD COLUMN "reason" text
      `);
    }

    if (!(await queryRunner.hasColumn('credit_transactions', 'expires_at'))) {
      await queryRunner.query(`
        ALTER TABLE "credit_transactions"
        ADD COLUMN "expires_at" TIMESTAMPTZ
      `);
    }

    if (!(await queryRunner.hasColumn('credit_transactions', 'actor_user_id'))) {
      await queryRunner.query(`
        ALTER TABLE "credit_transactions"
        ADD COLUMN "actor_user_id" integer
      `);
    }

    if (!(await queryRunner.hasColumn('credit_transactions', 'balance_before'))) {
      await queryRunner.query(`
        ALTER TABLE "credit_transactions"
        ADD COLUMN "balance_before" numeric(12,2)
      `);
    }

    if (!(await queryRunner.hasColumn('credit_transactions', 'balance_after'))) {
      await queryRunner.query(`
        ALTER TABLE "credit_transactions"
        ADD COLUMN "balance_after" numeric(12,2)
      `);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_credit_transactions_idempotency_key"
      ON "credit_transactions" ("idempotency_key")
      WHERE "idempotency_key" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;
    if (!(await queryRunner.hasTable('credit_transactions'))) return;

    await queryRunner.query(`
      DROP INDEX IF EXISTS "uq_credit_transactions_idempotency_key"
    `);

    for (const column of [
      'balance_after',
      'balance_before',
      'actor_user_id',
      'expires_at',
      'reason',
      'idempotency_key',
    ]) {
      if (await queryRunner.hasColumn('credit_transactions', column)) {
        await queryRunner.query(
          `ALTER TABLE "credit_transactions" DROP COLUMN "${column}"`,
        );
      }
    }
    // Enum values cannot be safely removed in Postgres without recreating the type.
  }
}
