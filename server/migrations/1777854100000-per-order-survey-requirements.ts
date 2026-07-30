import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

const USER_PENDING_INDEX = 'uq_tam_survey_requirements_user_pending';
const ORDER_REASON_INDEX = 'uq_tam_survey_requirements_order_reason';

export class PerOrderSurveyRequirements1777854100000 implements MigrationInterface {
  name = 'PerOrderSurveyRequirements1777854100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('tam_survey_requirements'))) return;

    const table = await queryRunner.getTable('tam_survey_requirements');
    const userPending = table?.indices.find(
      (index) => index.name === USER_PENDING_INDEX,
    );
    const orderReason = table?.indices.find(
      (index) => index.name === ORDER_REASON_INDEX,
    );

    if (userPending && !this.isExactUserPendingIndex(userPending)) {
      throw new Error(
        'incompatible adopted per-user pending survey index; refusing migration',
      );
    }
    if (orderReason && !this.isExactOrderReasonIndex(orderReason)) {
      throw new Error(
        'incompatible adopted per-order survey index; refusing migration',
      );
    }

    if (!orderReason) {
      const duplicates = (await queryRunner.query(`
        SELECT "order_id", "reason", COUNT(*) AS "requirement_count"
        FROM "tam_survey_requirements"
        GROUP BY "order_id", "reason"
        HAVING COUNT(*) > 1
        ORDER BY "order_id", "reason"
        LIMIT 1
      `)) as Array<{ order_id: number }>;
      if (duplicates.length > 0) {
        throw new Error(
          'duplicate per-order survey requirements must be resolved before migration',
        );
      }
      await queryRunner.query(`
        CREATE UNIQUE INDEX "${ORDER_REASON_INDEX}"
        ON "tam_survey_requirements" ("order_id", "reason")
      `);
    }

    if (userPending) {
      await queryRunner.query(`DROP INDEX "${USER_PENDING_INDEX}"`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('tam_survey_requirements'))) return;

    const table = await queryRunner.getTable('tam_survey_requirements');
    const userPending = table?.indices.find(
      (index) => index.name === USER_PENDING_INDEX,
    );
    if (userPending) {
      if (!this.isExactUserPendingIndex(userPending)) {
        throw new Error(
          'incompatible adopted per-user pending survey index; refusing migration rollback',
        );
      }
      return;
    }

    const duplicates = (await queryRunner.query(`
      SELECT "user_id", COUNT(*) AS "pending_count"
      FROM "tam_survey_requirements"
      WHERE "status" = 'pending'
      GROUP BY "user_id"
      HAVING COUNT(*) > 1
      ORDER BY "user_id"
      LIMIT 1
    `)) as Array<{ user_id: number }>;
    if (duplicates.length > 0) {
      throw new Error(
        'multiple pending survey requirements prevent safe migration rollback',
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX "${USER_PENDING_INDEX}"
      ON "tam_survey_requirements" ("user_id")
      WHERE "status" = 'pending'
    `);
  }

  private isExactUserPendingIndex(index: TableIndex): boolean {
    const normalizedWhere = index.where?.replace(/\s+/g, ' ').trim();
    return (
      index.isUnique &&
      index.columnNames.length === 1 &&
      index.columnNames[0] === 'user_id' &&
      (normalizedWhere === `"status" = 'pending'` ||
        normalizedWhere === "((status)::text = 'pending'::text)" ||
        normalizedWhere ===
          "(status = 'pending'::tam_survey_requirements_status_enum)")
    );
  }

  private isExactOrderReasonIndex(index: TableIndex): boolean {
    return (
      index.isUnique &&
      index.columnNames.length === 2 &&
      index.columnNames[0] === 'order_id' &&
      index.columnNames[1] === 'reason' &&
      !index.where
    );
  }
}
