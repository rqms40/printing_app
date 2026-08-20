import { SupplierQuoteConfirm1786516800000 } from '../../migrations/1786516800000-supplier-quote-confirm';

describe('SupplierQuoteConfirm1786516800000', () => {
  it('adds quote and customer-confirm columns on supplier_assignments', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as any;

    await new SupplierQuoteConfirm1786516800000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('quoted_price_minor');
    expect(sql).toContain('quoted_promised_date');
    expect(sql).toContain('customer_confirmed_quote_at');
  });
});
