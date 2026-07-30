import { BetaCompletionIntegrity1777854000000 } from '../../migrations/1777854000000-beta-completion-integrity';

describe('BetaCompletionIntegrity1777854000000', () => {
  it('allows multiple pending per-order requirements through to the final migration', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      getTable: jest.fn().mockResolvedValue({ indices: [] }),
      query: jest.fn(),
    } as any;

    await expect(
      new BetaCompletionIntegrity1777854000000().up(queryRunner),
    ).resolves.toBeUndefined();

    expect(queryRunner.query).not.toHaveBeenCalled();
  });

  it('does not introduce a contradictory per-user pending index', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      getTable: jest.fn().mockResolvedValue({ indices: [] }),
      query: jest.fn(),
    } as any;

    await new BetaCompletionIntegrity1777854000000().up(queryRunner);

    expect(queryRunner.query).not.toHaveBeenCalled();
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
