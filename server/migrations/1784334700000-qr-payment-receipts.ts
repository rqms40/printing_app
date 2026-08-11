import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * QR Ph (Instapay) payment receipts: customer uploads proof at checkout;
 * ops/superadmin verifies before payment authorization for production.
 */
export class QrPaymentReceipts1784334700000 implements MigrationInterface {
  name = 'QrPaymentReceipts1784334700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extend file purpose enum for payment receipt uploads.
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
            AND e.enumlabel = 'payment_receipt'
        ) THEN
          ALTER TYPE "file_metadata_purpose_enum" ADD VALUE 'payment_receipt';
        END IF;
      END
      $$;
    `);

    if (await queryRunner.hasTable('qr_payment_receipts')) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE "qr_payment_receipts" (
        "id" SERIAL PRIMARY KEY,
        "order_id" integer NOT NULL
          REFERENCES "orders"("id") ON DELETE CASCADE,
        "batch_order_id" integer NULL
          REFERENCES "batch_orders"("id") ON DELETE SET NULL,
        "user_id" integer NOT NULL
          REFERENCES "users"("id") ON DELETE CASCADE,
        "file_id" integer NOT NULL
          REFERENCES "file_metadata"("id") ON DELETE RESTRICT,
        "status" varchar(20) NOT NULL DEFAULT 'pending',
        "verified_by_user_id" integer NULL
          REFERENCES "users"("id") ON DELETE SET NULL,
        "verified_at" TIMESTAMP NULL,
        "rejection_reason" text NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_qr_payment_receipts_order_id"
      ON "qr_payment_receipts" ("order_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_qr_payment_receipts_status"
      ON "qr_payment_receipts" ("status")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_qr_payment_receipts_created_at"
      ON "qr_payment_receipts" ("created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_qr_payment_receipts_user_id"
      ON "qr_payment_receipts" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('qr_payment_receipts')) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "idx_qr_payment_receipts_user_id"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "idx_qr_payment_receipts_created_at"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "idx_qr_payment_receipts_status"`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS "uq_qr_payment_receipts_order_id"`,
      );
      await queryRunner.query(`DROP TABLE "qr_payment_receipts"`);
    }
    // Postgres cannot easily remove enum values; leave payment_receipt in place.
  }
}
