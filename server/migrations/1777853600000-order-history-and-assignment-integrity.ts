import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

export class OrderHistoryAndAssignmentIntegrity1777853600000 implements MigrationInterface {
  name = 'OrderHistoryAndAssignmentIntegrity1777853600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('delivery_assignments'))) return;

    if (!(await queryRunner.hasColumn('delivery_assignments', 'is_current'))) {
      await queryRunner.query(`
        ALTER TABLE "delivery_assignments"
        ADD COLUMN "is_current" boolean NOT NULL DEFAULT true
      `);
    }

    await queryRunner.query(`
      UPDATE delivery_assignments
      SET is_current = false
      WHERE status::text = 'declined'
    `);
    const canUseOwningOrder =
      (await queryRunner.hasTable('orders')) &&
      (await queryRunner.hasTable('rider_profiles'));
    await queryRunner.query(
      canUseOwningOrder
        ? `
          WITH current_assignment_candidates AS (
            SELECT assignment.id,
                   assignment.order_id,
                   assignment.assigned_at,
                   owning_order.id IS NULL
                     OR owning_order.order_status::text IN (
                       'rider_assigned', 'picked_up', 'on_the_way',
                       'arrived_at_destination', 'delivered'
                     ) AS should_have_current,
                   CASE
                     WHEN (
                       (owning_order.order_status::text = 'rider_assigned'
                         AND assignment.status::text IN ('assigned', 'accepted'))
                       OR (owning_order.order_status::text = 'picked_up'
                         AND assignment.status::text = 'picked_up')
                       OR (owning_order.order_status::text = 'on_the_way'
                         AND assignment.status::text = 'on_the_way')
                       OR (owning_order.order_status::text = 'arrived_at_destination'
                         AND assignment.status::text = 'arrived')
                       OR (owning_order.order_status::text = 'delivered'
                         AND assignment.status::text = 'delivered')
                     ) THEN 0
                     ELSE 1
                   END AS compatibility_rank,
                   CASE
                     WHEN owning_order.assigned_rider_id IS NOT NULL
                      AND rider.user_id = owning_order.assigned_rider_id
                       THEN 0
                     ELSE 1
                   END AS rider_rank
            FROM delivery_assignments AS assignment
            LEFT JOIN orders AS owning_order
              ON owning_order.id = assignment.order_id
            LEFT JOIN rider_profiles AS rider
              ON rider.id = assignment.rider_id
            WHERE assignment.is_current = true
          ),
          ranked_current_assignments AS (
            SELECT id,
                   should_have_current,
                   ROW_NUMBER() OVER (
                     PARTITION BY order_id
                     ORDER BY
                       compatibility_rank,
                       rider_rank,
                       assigned_at DESC,
                       id DESC
                   ) AS occurrence
            FROM current_assignment_candidates
          )
          UPDATE delivery_assignments AS assignment
          SET is_current = false
          FROM ranked_current_assignments AS ranked
          WHERE assignment.id = ranked.id
            AND (
              NOT ranked.should_have_current
              OR ranked.occurrence > 1
            )
        `
        : `
          WITH ranked_current_assignments AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                     PARTITION BY order_id
                     ORDER BY assigned_at DESC, id DESC
                   ) AS occurrence
            FROM delivery_assignments
            WHERE is_current = true
          )
          UPDATE delivery_assignments AS assignment
          SET is_current = false
          FROM ranked_current_assignments AS ranked
          WHERE assignment.id = ranked.id
            AND ranked.occurrence > 1
        `,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        uq_delivery_assignments_current_order
      ON delivery_assignments (order_id)
      WHERE is_current = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;
    if (!(await queryRunner.hasTable('delivery_assignments'))) return;

    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_delivery_assignments_current_order
    `);
    if (await queryRunner.hasColumn('delivery_assignments', 'is_current')) {
      await queryRunner.query(`
        ALTER TABLE "delivery_assignments" DROP COLUMN "is_current"
      `);
    }
  }
}
