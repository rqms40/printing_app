import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rider payout QR for ops/super to pay the rider, plus per-delivery
 * admin receipts stored on rider_payouts.
 */
export class RiderPayoutQrAndAdminReceipt1787228600000
  implements MigrationInterface
{
  name = 'RiderPayoutQrAndAdminReceipt1787228600000';

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
            AND e.enumlabel = 'rider_payout_qr'
        ) THEN
          ALTER TYPE "file_metadata_purpose_enum" ADD VALUE 'rider_payout_qr';
        END IF;
      END
      $$;
    `);

    if (await queryRunner.hasTable('rider_profiles')) {
      if (
        !(await queryRunner.hasColumn('rider_profiles', 'payout_qr_file_id'))
      ) {
        await queryRunner.query(`
          ALTER TABLE "rider_profiles"
          ADD COLUMN "payout_qr_file_id" int NULL
        `);
      }
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'fk_rider_profiles_payout_qr_file'
          ) THEN
            ALTER TABLE "rider_profiles"
            ADD CONSTRAINT "fk_rider_profiles_payout_qr_file"
            FOREIGN KEY ("payout_qr_file_id")
            REFERENCES "file_metadata"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION;
          END IF;
        END
        $$;
      `);
    }

    if (!(await queryRunner.hasTable('rider_payouts'))) {
      await queryRunner.query(`
        CREATE TABLE "rider_payouts" (
          "id" SERIAL PRIMARY KEY,
          "rider_id" int NOT NULL
            REFERENCES "rider_profiles"("id") ON DELETE CASCADE,
          "assignment_id" int NOT NULL
            REFERENCES "delivery_assignments"("id") ON DELETE CASCADE,
          "order_id" int NOT NULL
            REFERENCES "orders"("id") ON DELETE CASCADE,
          "amount_minor" bigint NOT NULL,
          "admin_receipt_file_id" int NULL
            REFERENCES "file_metadata"("id") ON DELETE SET NULL,
          "paid_at" timestamptz NULL,
          "paid_by_user_id" int NULL
            REFERENCES "users"("id") ON DELETE SET NULL,
          "created_at" timestamptz NOT NULL DEFAULT now(),
          "updated_at" timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT "uq_rider_payouts_assignment_id" UNIQUE ("assignment_id")
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_rider_payouts_rider_id"
        ON "rider_payouts" ("rider_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_rider_payouts_order_id"
        ON "rider_payouts" ("order_id")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('rider_payouts')) {
      await queryRunner.query(`DROP TABLE "rider_payouts"`);
    }
    if (await queryRunner.hasTable('rider_profiles')) {
      await queryRunner.query(`
        ALTER TABLE "rider_profiles"
        DROP CONSTRAINT IF EXISTS "fk_rider_profiles_payout_qr_file"
      `);
      if (await queryRunner.hasColumn('rider_profiles', 'payout_qr_file_id')) {
        await queryRunner.query(
          `ALTER TABLE "rider_profiles" DROP COLUMN "payout_qr_file_id"`,
        );
      }
    }
  }
}
