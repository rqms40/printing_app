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
    }
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    return;
  }
}
