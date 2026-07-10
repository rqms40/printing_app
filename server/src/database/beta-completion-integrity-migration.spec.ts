import { BetaCompletionIntegrity1777854000000 } from '../../migrations/1777854000000-beta-completion-integrity';

describe('BetaCompletionIntegrity1777854000000', () => {
  it('fails closed on duplicate pending requirements before adding the invariant', async () => {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      getTable: jest.fn().mockResolvedValue({ indices: [] }),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return sql.includes('HAVING COUNT(*) > 1')
          ? [{ user_id: 10, pending_count: '2' }]
          : [];
      }),
    } as any;

    await expect(
      new BetaCompletionIntegrity1777854000000().up(queryRunner),
    ).rejects.toThrow('duplicate pending beta survey requirements');

    const sql = queries.join('\n');
    expect(sql).toContain('HAVING COUNT(*) > 1');
    expect(sql).not.toContain('CREATE UNIQUE INDEX');
  });

  it('adds the exact partial unique index to a clean adopted schema', async () => {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      getTable: jest.fn().mockResolvedValue({ indices: [] }),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as any;

    await new BetaCompletionIntegrity1777854000000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('uq_tam_survey_requirements_user_pending');
    expect(sql).toContain('ON "tam_survey_requirements" ("user_id")');
    expect(sql).toContain(`WHERE "status" = 'pending'`);
  });

  it('rejects a malformed adopted index without replacing it', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      getTable: jest.fn().mockResolvedValue({
        indices: [
          {
            name: 'uq_tam_survey_requirements_user_pending',
            isUnique: false,
            columnNames: ['user_id'],
            where: `"status" = 'pending'`,
          },
        ],
      }),
      query,
    } as any;

    await expect(
      new BetaCompletionIntegrity1777854000000().up(queryRunner),
    ).rejects.toThrow('incompatible adopted beta survey pending index');
    expect(query).not.toHaveBeenCalled();
  });
});
