import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Supplier payout QR for ops/super to pay the shop, plus admin receipt
 * stored on the payout after payment authorization.
 */
export class SupplierPayoutQrAndAdminReceipt1787228500000
  implements MigrationInterface
{
  name = 'SupplierPayoutQrAndAdminReceipt1787228500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'file_metadata_purpose_enum'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'file_metadata_purpose_enum'
            AND e.enumlabel = 'supplier_payout_qr'
        ) THEN
          ALTER TYPE "file_metadata_purpose_enum" ADD VALUE 'supplier_payout_qr';
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'file_metadata_purpose_enum'
        ) AND NOT EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'file_metadata_purpose_enum'
            AND e.enumlabel = 'payout_receipt'
        ) THEN
          ALTER TYPE "file_metadata_purpose_enum" ADD VALUE 'payout_receipt';
        END IF;
      END
      $$;
    `);

    if (await queryRunner.hasTable('supplier_profiles')) {
      if (
        !(await queryRunner.hasColumn(
          'supplier_profiles',
          'payout_qr_file_id',
        ))
      ) {
        await queryRunner.query(`
          ALTER TABLE "supplier_profiles"
          ADD COLUMN "payout_qr_file_id" int NULL
        `);
      }
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'fk_supplier_profiles_payout_qr_file'
          ) THEN
            ALTER TABLE "supplier_profiles"
            ADD CONSTRAINT "fk_supplier_profiles_payout_qr_file"
            FOREIGN KEY ("payout_qr_file_id")
            REFERENCES "file_metadata"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
          END IF;
        END
        $$;
      `);
    }

    if (await queryRunner.hasTable('payouts')) {
      if (!(await queryRunner.hasColumn('payouts', 'admin_receipt_file_id'))) {
        await queryRunner.query(`
          ALTER TABLE "payouts"
          ADD COLUMN "admin_receipt_file_id" int NULL
        `);
      }
      if (!(await queryRunner.hasColumn('payouts', 'authorized_at'))) {
        await queryRunner.query(`
          ALTER TABLE "payouts"
          ADD COLUMN "authorized_at" timestamptz NULL
        `);
      }
      if (
        !(await queryRunner.hasColumn('payouts', 'authorized_by_user_id'))
      ) {
        await queryRunner.query(`
          ALTER TABLE "payouts"
          ADD COLUMN "authorized_by_user_id" int NULL
        `);
      }
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'fk_payouts_admin_receipt_file'
          ) THEN
            ALTER TABLE "payouts"
            ADD CONSTRAINT "fk_payouts_admin_receipt_file"
            FOREIGN KEY ("admin_receipt_file_id")
            REFERENCES "file_metadata"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'fk_payouts_authorized_by_user'
          ) THEN
            ALTER TABLE "payouts"
            ADD CONSTRAINT "fk_payouts_authorized_by_user"
            FOREIGN KEY ("authorized_by_user_id")
            REFERENCES "users"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
          END IF;
        END
        $$;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('payouts')) {
      await queryRunner.query(`
        ALTER TABLE "payouts"
        DROP CONSTRAINT IF EXISTS "fk_payouts_admin_receipt_file"
      `);
      await queryRunner.query(`
        ALTER TABLE "payouts"
        DROP CONSTRAINT IF EXISTS "fk_payouts_authorized_by_user"
      `);
      if (await queryRunner.hasColumn('payouts', 'admin_receipt_file_id')) {
        await queryRunner.query(
          `ALTER TABLE "payouts" DROP COLUMN "admin_receipt_file_id"`,
        );
      }
      if (await queryRunner.hasColumn('payouts', 'authorized_at')) {
        await queryRunner.query(
          `ALTER TABLE "payouts" DROP COLUMN "authorized_at"`,
        );
      }
      if (await queryRunner.hasColumn('payouts', 'authorized_by_user_id')) {
        await queryRunner.query(
          `ALTER TABLE "payouts" DROP COLUMN "authorized_by_user_id"`,
        );
      }
    }
    if (await queryRunner.hasTable('supplier_profiles')) {
      await queryRunner.query(`
        ALTER TABLE "supplier_profiles"
        DROP CONSTRAINT IF EXISTS "fk_supplier_profiles_payout_qr_file"
      `);
      if (
        await queryRunner.hasColumn('supplier_profiles', 'payout_qr_file_id')
      ) {
        await queryRunner.query(
          `ALTER TABLE "supplier_profiles" DROP COLUMN "payout_qr_file_id"`,
        );
      }
    }
  }
}
