import { QueryRunner } from 'typeorm';
import { OrderHistoryAndAssignmentIntegrity1777853600000 } from '../../migrations/1777853600000-order-history-and-assignment-integrity';

describe('OrderHistoryAndAssignmentIntegrity1777853600000', () => {
  it('adds current-assignment state, reconciles duplicates, and creates a partial unique index', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(false),
      query,
    } as unknown as QueryRunner;

    await new OrderHistoryAndAssignmentIntegrity1777853600000().up(queryRunner);

    const calls = query.mock.calls as unknown as Array<[string]>;
    const sql = calls.map(([statement]) => statement).join('\n');
    expect(sql).toContain('ADD COLUMN "is_current" boolean');
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain('SET is_current = false');
    expect(sql).toContain('uq_delivery_assignments_current_order');
    expect(sql).toContain('WHERE is_current = true');
  });

  it('fails closed on down for an adopted schema', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ ownership: 'adopted' }]);
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
      query,
    } as unknown as QueryRunner;

    await new OrderHistoryAndAssignmentIntegrity1777853600000().down(
      queryRunner,
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('SELECT "ownership"');
  });
});
