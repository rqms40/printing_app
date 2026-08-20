import { SupplierPickupMap1786516600000 } from '../../migrations/1786516600000-supplier-pickup-map';

describe('SupplierPickupMap1786516600000', () => {
  it('adds supplier shop coords and pickup/dropoff stop kinds', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as any;

    await new SupplierPickupMap1786516600000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('latitude');
    expect(sql).toContain('longitude');
    expect(sql).toContain('CHK_supplier_profiles_location');
    expect(sql).toContain('dispatch_stop_kind_enum');
    expect(sql).toContain('uq_dispatch_plan_stops_assignment_kind');
    expect(sql).toContain('DROP INDEX IF EXISTS "uq_dispatch_plan_stops_assignment"');
    expect(sql).toContain("supplier@gridgo.ph");
  });
});
