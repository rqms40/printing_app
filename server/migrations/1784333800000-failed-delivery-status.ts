import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

/**
 * Marketplace Phase 7 Task 7.3:
 * Failed delivery assignment/order statuses + failed_at timestamp.
 * Redelivery fee approval remains an ops stub (status → ready_for_dispatch).
 */
export class FailedDeliveryStatus1784333800000 implements MigrationInterface {
  name = 'FailedDeliveryStatus1784333800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."delivery_assignments_status_enum"
          ADD VALUE IF NOT EXISTS 'failed';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TYPE "public"."orders_order_status_enum"
          ADD VALUE IF NOT EXISTS 'delivery_failed';
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    if (await queryRunner.hasTable('delivery_assignments')) {
      if (!(await queryRunner.hasColumn('delivery_assignments', 'failed_at'))) {
        await queryRunner.query(`
          ALTER TABLE "delivery_assignments"
          ADD COLUMN "failed_at" TIMESTAMP
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;
    if (!(await queryRunner.hasTable('delivery_assignments'))) return;

    if (await queryRunner.hasColumn('delivery_assignments', 'failed_at')) {
      await queryRunner.query(`
        ALTER TABLE "delivery_assignments" DROP COLUMN "failed_at"
      `);
    }
    // Postgres cannot easily remove enum values; leave labels in place.
  }
}
