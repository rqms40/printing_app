import { AddServiceFeePercent1787228100000 } from '../../migrations/1787228100000-AddServiceFeePercent';

describe('AddServiceFeePercent1787228100000', () => {
  it('adds service_fee_percent on delivery_settings', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as any;

    await new AddServiceFeePercent1787228100000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('service_fee_percent');
  });
});
