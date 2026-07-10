import { PersistedDispatchPlans1777853900000 } from '../../migrations/1777853900000-persisted-dispatch-plans';

describe('PersistedDispatchPlans1777853900000', () => {
  it('creates versioned plans, independent stop state, and one active plan', async () => {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(false),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as any;

    await new PersistedDispatchPlans1777853900000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('CREATE TABLE "dispatch_plans"');
    expect(sql).toContain('CREATE TABLE "dispatch_plan_stops"');
    expect(sql).toContain('uq_dispatch_plans_active_rider');
    expect(sql).toContain('WHERE "status" = \'active\'');
    expect(sql).toContain('uq_dispatch_plans_rider_version');
    expect(sql).toContain('uq_dispatch_plan_stops_sequence');
    expect(sql).toContain('uq_dispatch_plan_stops_assignment');
    expect(sql).toContain(
      'REFERENCES "rider_profiles"("id") ON DELETE RESTRICT',
    );
    expect(sql).toContain(
      'REFERENCES "delivery_assignments"("id") ON DELETE RESTRICT',
    );
    expect(sql).toContain('CHK_dispatch_plans_totals');
    expect(sql).toContain('CHK_dispatch_plan_stops_destination');
  });

  it('fails closed for an incompatible adopted table', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      getTable: jest.fn().mockResolvedValue({
        findColumnByName: (name: string) =>
          name === 'id' ? { type: 'integer' } : undefined,
      }),
      query: jest.fn(),
    } as any;

    await expect(
      new PersistedDispatchPlans1777853900000().up(queryRunner),
    ).rejects.toThrow('Incompatible adopted dispatch_plans table');
    expect(queryRunner.query).not.toHaveBeenCalled();
  });
});
