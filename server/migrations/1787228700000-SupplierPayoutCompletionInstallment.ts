import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Second 50% supplier installment after order completion:
 * remaining amount + ops/super receipt, separate from the first authorize.
 */
export class SupplierPayoutCompletionInstallment1787228700000
  implements MigrationInterface
{
  name = 'SupplierPayoutCompletionInstallment1787228700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payouts'))) return;

    if (!(await queryRunner.hasColumn('payouts', 'deposit_amount_minor'))) {
      await queryRunner.query(`
        ALTER TABLE "payouts"
        ADD COLUMN "deposit_amount_minor" bigint NULL
      `);
    }
    if (!(await queryRunner.hasColumn('payouts', 'completion_amount_minor'))) {
      await queryRunner.query(`
        ALTER TABLE "payouts"
        ADD COLUMN "completion_amount_minor" bigint NULL
      `);
    }
    if (
      !(await queryRunner.hasColumn('payouts', 'completion_receipt_file_id'))
    ) {
      await queryRunner.query(`
        ALTER TABLE "payouts"
        ADD COLUMN "completion_receipt_file_id" int NULL
      `);
    }
    if (!(await queryRunner.hasColumn('payouts', 'completion_authorized_at'))) {
      await queryRunner.query(`
        ALTER TABLE "payouts"
        ADD COLUMN "completion_authorized_at" timestamptz NULL
      `);
    }
    if (
      !(await queryRunner.hasColumn(
        'payouts',
        'completion_authorized_by_user_id',
      ))
    ) {
      await queryRunner.query(`
        ALTER TABLE "payouts"
        ADD COLUMN "completion_authorized_by_user_id" int NULL
      `);
    }

    await queryRunner.query(`
      UPDATE "payouts"
      SET
        "deposit_amount_minor" = FLOOR(("gross_minor")::bigint / 2),
        "completion_amount_minor" =
          ("gross_minor")::bigint - FLOOR(("gross_minor")::bigint / 2)
      WHERE "authorized_at" IS NOT NULL
        AND "deposit_amount_minor" IS NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'fk_payouts_completion_receipt_file'
        ) THEN
          ALTER TABLE "payouts"
          ADD CONSTRAINT "fk_payouts_completion_receipt_file"
          FOREIGN KEY ("completion_receipt_file_id")
          REFERENCES "file_metadata"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'fk_payouts_completion_authorized_by_user'
        ) THEN
          ALTER TABLE "payouts"
          ADD CONSTRAINT "fk_payouts_completion_authorized_by_user"
          FOREIGN KEY ("completion_authorized_by_user_id")
          REFERENCES "users"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('payouts'))) return;

    await queryRunner.query(`
      ALTER TABLE "payouts"
      DROP CONSTRAINT IF EXISTS "fk_payouts_completion_receipt_file"
    `);
    await queryRunner.query(`
      ALTER TABLE "payouts"
      DROP CONSTRAINT IF EXISTS "fk_payouts_completion_authorized_by_user"
    `);
    for (const column of [
      'completion_authorized_by_user_id',
      'completion_authorized_at',
      'completion_receipt_file_id',
      'completion_amount_minor',
      'deposit_amount_minor',
    ]) {
      if (await queryRunner.hasColumn('payouts', column)) {
        await queryRunner.query(
          `ALTER TABLE "payouts" DROP COLUMN "${column}"`,
        );
      }
    }
  }
}
