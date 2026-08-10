import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

/**
 * Marketplace Phase 2 Task 2.2:
 * Order payment authorization fields + immutable commercial snapshot.
 *
 * - final_total_minor / delivery_fee_minor (bigint PHP centavos)
 * - payment_authorization_status enum (none|authorized|failed|expired)
 * - cod_eligible boolean
 * - authorization_snapshot jsonb (price/fees/commission/specs/artwork/promised)
 *
 * Existing payment_method varchar is retained for legacy + marketplace labels.
 * Backfill minor columns from legacy decimal majors when present.
 */
export class OrderPaymentAuthorizationFields1784333300000
  implements MigrationInterface
{
  name = 'OrderPaymentAuthorizationFields1784333300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('orders'))) {
      return;
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.orders_payment_authorization_status_enum') IS NULL THEN
          CREATE TYPE "public"."orders_payment_authorization_status_enum" AS ENUM (
            'none',
            'authorized',
            'failed',
            'expired'
          );
        END IF;
      END $$;
    `);

    if (!(await queryRunner.hasColumn('orders', 'final_total_minor'))) {
      await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN "final_total_minor" bigint
      `);
    }

    if (!(await queryRunner.hasColumn('orders', 'delivery_fee_minor'))) {
      await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN "delivery_fee_minor" bigint
      `);
    }

    if (
      !(await queryRunner.hasColumn('orders', 'payment_authorization_status'))
    ) {
      await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN "payment_authorization_status"
          "public"."orders_payment_authorization_status_enum"
          NOT NULL DEFAULT 'none'
      `);
    }

    if (!(await queryRunner.hasColumn('orders', 'cod_eligible'))) {
      await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN "cod_eligible" boolean NOT NULL DEFAULT false
      `);
    }

    if (!(await queryRunner.hasColumn('orders', 'authorization_snapshot'))) {
      await queryRunner.query(`
        ALTER TABLE "orders"
        ADD COLUMN "authorization_snapshot" jsonb
      `);
    }

    // Backfill minor units from legacy major decimals (centavos = round(pesos * 100)).
    await queryRunner.query(`
      UPDATE "orders"
      SET
        "delivery_fee_minor" = ROUND(COALESCE("delivery_fee", 0) * 100)::bigint,
        "final_total_minor" = ROUND(
          (COALESCE("total_price", 0) + COALESCE("delivery_fee", 0)) * 100
        )::bigint
      WHERE "final_total_minor" IS NULL
         OR "delivery_fee_minor" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;
    if (!(await queryRunner.hasTable('orders'))) return;

    if (await queryRunner.hasColumn('orders', 'authorization_snapshot')) {
      await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN "authorization_snapshot"
      `);
    }
    if (await queryRunner.hasColumn('orders', 'cod_eligible')) {
      await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN "cod_eligible"
      `);
    }
    if (
      await queryRunner.hasColumn('orders', 'payment_authorization_status')
    ) {
      await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN "payment_authorization_status"
      `);
    }
    if (await queryRunner.hasColumn('orders', 'delivery_fee_minor')) {
      await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN "delivery_fee_minor"
      `);
    }
    if (await queryRunner.hasColumn('orders', 'final_total_minor')) {
      await queryRunner.query(`
        ALTER TABLE "orders" DROP COLUMN "final_total_minor"
      `);
    }

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."orders_payment_authorization_status_enum"
    `);
  }
}
