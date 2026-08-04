import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

/**
 * Marketplace Phase 2 Task 2.1:
 * Replace shop-queue order statuses with marketplace lifecycle enum.
 *
 * Strategy (safe for PG enums with many-to-one remaps):
 * 1. Drop default, cast column to text
 * 2. UPDATE rows via legacy map
 * 3. Recreate enum type with marketplace labels
 * 4. Cast column back + set default `submitted`
 * 5. Remap order_status_history varchar labels
 */
export class MarketplaceOrderStatus1784333200000
  implements MigrationInterface
{
  name = 'MarketplaceOrderStatus1784333200000';

  private readonly legacyMap: ReadonlyArray<readonly [string, string]> = [
    ['order_placed', 'submitted'],
    ['file_verified', 'approved_for_matching'],
    ['file_declined', 'file_rejected'],
    ['printing_in_progress', 'production'],
    ['finishing_mounting', 'production'],
    ['quality_checked', 'supplier_self_qc'],
    ['on_the_way', 'out_for_delivery'],
    ['arrived_at_destination', 'out_for_delivery'],
    ['completed_pickup', 'collected_by_customer'],
    // same-name labels kept: ready_for_dispatch, rider_assigned, picked_up,
    // delivered, cancelled
  ];

  private readonly marketplaceLabels = [
    'draft',
    'submitted',
    'needs_qa',
    'client_correction',
    'proof_approval',
    'approved_for_matching',
    'supplier_assigned',
    'supplier_accepted',
    'awaiting_payment',
    'payment_authorized',
    'production',
    'supplier_self_qc',
    'ready_for_dispatch',
    'rider_assigned',
    'picked_up',
    'out_for_delivery',
    'delivered',
    'collected_by_customer',
    'issue_window_open',
    'completed',
    'cancelled',
    'file_rejected',
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('orders'))) {
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "orders" ALTER COLUMN "order_status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ALTER COLUMN "order_status" TYPE text
      USING "order_status"::text
    `);

    for (const [from, to] of this.legacyMap) {
      await queryRunner.query(
        `UPDATE "orders" SET "order_status" = $1 WHERE "order_status" = $2`,
        [to, from],
      );
    }

    if (await queryRunner.hasTable('order_status_history')) {
      for (const [from, to] of this.legacyMap) {
        await queryRunner.query(
          `UPDATE "order_status_history" SET "from_status" = $1 WHERE "from_status" = $2`,
          [to, from],
        );
        await queryRunner.query(
          `UPDATE "order_status_history" SET "to_status" = $1 WHERE "to_status" = $2`,
          [to, from],
        );
      }
    }

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."orders_order_status_enum"
    `);

    const enumList = this.marketplaceLabels.map((v) => `'${v}'`).join(', ');
    await queryRunner.query(`
      CREATE TYPE "public"."orders_order_status_enum" AS ENUM (${enumList})
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ALTER COLUMN "order_status"
      TYPE "public"."orders_order_status_enum"
      USING "order_status"::"public"."orders_order_status_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ALTER COLUMN "order_status"
      SET DEFAULT 'submitted'::"public"."orders_order_status_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;
    if (!(await queryRunner.hasTable('orders'))) return;

    // Best-effort reverse: map marketplace labels back to nearest legacy.
    const reverseMap: ReadonlyArray<readonly [string, string]> = [
      ['draft', 'order_placed'],
      ['submitted', 'order_placed'],
      ['needs_qa', 'order_placed'],
      ['client_correction', 'order_placed'],
      ['proof_approval', 'file_verified'],
      ['approved_for_matching', 'file_verified'],
      ['supplier_assigned', 'file_verified'],
      ['supplier_accepted', 'file_verified'],
      ['awaiting_payment', 'file_verified'],
      ['payment_authorized', 'file_verified'],
      ['production', 'printing_in_progress'],
      ['supplier_self_qc', 'quality_checked'],
      ['out_for_delivery', 'on_the_way'],
      ['collected_by_customer', 'completed_pickup'],
      ['issue_window_open', 'delivered'],
      ['completed', 'delivered'],
      ['file_rejected', 'file_declined'],
    ];

    await queryRunner.query(`
      ALTER TABLE "orders" ALTER COLUMN "order_status" DROP DEFAULT
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ALTER COLUMN "order_status" TYPE text
      USING "order_status"::text
    `);

    for (const [from, to] of reverseMap) {
      await queryRunner.query(
        `UPDATE "orders" SET "order_status" = $1 WHERE "order_status" = $2`,
        [to, from],
      );
    }

    if (await queryRunner.hasTable('order_status_history')) {
      for (const [from, to] of reverseMap) {
        await queryRunner.query(
          `UPDATE "order_status_history" SET "from_status" = $1 WHERE "from_status" = $2`,
          [to, from],
        );
        await queryRunner.query(
          `UPDATE "order_status_history" SET "to_status" = $1 WHERE "to_status" = $2`,
          [to, from],
        );
      }
    }

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."orders_order_status_enum"
    `);

    await queryRunner.query(`
      CREATE TYPE "public"."orders_order_status_enum" AS ENUM (
        'order_placed',
        'file_verified',
        'file_declined',
        'printing_in_progress',
        'finishing_mounting',
        'quality_checked',
        'ready_for_dispatch',
        'rider_assigned',
        'picked_up',
        'on_the_way',
        'arrived_at_destination',
        'delivered',
        'completed_pickup',
        'cancelled'
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ALTER COLUMN "order_status"
      TYPE "public"."orders_order_status_enum"
      USING "order_status"::"public"."orders_order_status_enum"
    `);

    await queryRunner.query(`
      ALTER TABLE "orders"
      ALTER COLUMN "order_status"
      SET DEFAULT 'order_placed'::"public"."orders_order_status_enum"
    `);
  }
}
