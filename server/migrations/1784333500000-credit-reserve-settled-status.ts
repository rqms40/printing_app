import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marketplace Phase 3 Task 3.1 fix: mark consumed reserves as settled.
 * Prevents double-spend / double-release of the same reserve hold.
 */
export class CreditReserveSettledStatus1784333500000
  implements MigrationInterface
{
  name = 'CreditReserveSettledStatus1784333500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.credit_transactions_status_enum') IS NOT NULL THEN
          ALTER TYPE "public"."credit_transactions_status_enum"
            ADD VALUE IF NOT EXISTS 'settled';
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Enum values cannot be safely removed in Postgres without recreating the type.
  }
}
