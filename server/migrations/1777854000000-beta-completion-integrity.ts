import { MigrationInterface, QueryRunner } from 'typeorm';

export class BetaCompletionIntegrity1777854000000 implements MigrationInterface {
  name = 'BetaCompletionIntegrity1777854000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('tam_survey_requirements'))) return;

    const table = await queryRunner.getTable('tam_survey_requirements');
    const existing = table?.indices.find(
      (index) => index.name === 'uq_tam_survey_requirements_user_pending',
    );
    if (existing) {
      const normalizedWhere = existing.where?.replace(/\s+/g, ' ').trim();
      if (
        !existing.isUnique ||
        existing.columnNames.length !== 1 ||
        existing.columnNames[0] !== 'user_id' ||
        normalizedWhere !== `"status" = 'pending'`
      ) {
        throw new Error(
          'incompatible adopted beta survey pending index; refusing to replace it',
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
        'duplicate pending beta survey requirements must be resolved before migration',
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX
        "uq_tam_survey_requirements_user_pending"
      ON "tam_survey_requirements" ("user_id")
      WHERE "status" = 'pending'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('tam_survey_requirements'))) return;
    await queryRunner.query(
      'DROP INDEX IF EXISTS "uq_tam_survey_requirements_user_pending"',
    );
  }
}
