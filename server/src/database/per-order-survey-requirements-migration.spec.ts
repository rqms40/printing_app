import { PerOrderSurveyRequirements1777854100000 } from '../../migrations/1777854100000-per-order-survey-requirements';

describe('PerOrderSurveyRequirements1777854100000', () => {
  it('replaces the exact per-user pending index with per-order integrity', async () => {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      getTable: jest.fn().mockResolvedValue({
        indices: [
          {
            name: 'uq_tam_survey_requirements_user_pending',
            isUnique: true,
            columnNames: ['user_id'],
            where: `"status" = 'pending'`,
          },
        ],
      }),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as any;

    await new PerOrderSurveyRequirements1777854100000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('uq_tam_survey_requirements_order_reason');
    expect(sql).toContain('("order_id", "reason")');
    expect(sql).toContain(
      'DROP INDEX "uq_tam_survey_requirements_user_pending"',
    );
  });

  it('rejects malformed adopted per-order integrity before dropping user protection', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      getTable: jest.fn().mockResolvedValue({
        indices: [
          {
            name: 'uq_tam_survey_requirements_user_pending',
            isUnique: true,
            columnNames: ['user_id'],
            where: `"status" = 'pending'`,
          },
          {
            name: 'uq_tam_survey_requirements_order_reason',
            isUnique: false,
            columnNames: ['order_id', 'reason'],
          },
        ],
      }),
      query,
    } as any;

    await expect(
      new PerOrderSurveyRequirements1777854100000().up(queryRunner),
    ).rejects.toThrow('incompatible adopted per-order survey index');
    expect(query).not.toHaveBeenCalled();
  });

  it('accepts the exact pending predicate normalized by PostgreSQL', async () => {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      getTable: jest.fn().mockResolvedValue({
        indices: [
          {
            name: 'uq_tam_survey_requirements_user_pending',
            isUnique: true,
            columnNames: ['user_id'],
            where: "(status = 'pending'::tam_survey_requirements_status_enum)",
          },
          {
            name: 'uq_tam_survey_requirements_order_reason',
            isUnique: true,
            columnNames: ['order_id', 'reason'],
          },
        ],
      }),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as any;

    await new PerOrderSurveyRequirements1777854100000().up(queryRunner);

    expect(queries).toEqual([
      'DROP INDEX "uq_tam_survey_requirements_user_pending"',
    ]);
  });
});
