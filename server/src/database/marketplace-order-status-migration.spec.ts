import type { QueryRunner } from 'typeorm';
import { MarketplaceOrderStatus1784333200000 } from '../../migrations/1784333200000-marketplace-order-status';

describe('MarketplaceOrderStatus1784333200000', () => {
  function createQueryRunner(
    opts: {
      hasTable?: boolean | ((name: string) => boolean);
      ownership?: string;
    } = {},
  ) {
    const { hasTable = true, ownership = 'baseline' } = opts;
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async (name: string) => {
        if (typeof hasTable === 'function') return hasTable(name);
        return hasTable;
      }),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('ownership') || sql.includes('schema_ownership')) {
          return [{ ownership }];
        }
        return [];
      }),
    } as unknown as QueryRunner;
    return { queryRunner, queries };
  }

  it('casts order_status through text, remaps legacy rows, recreates enum', async () => {
    const { queryRunner, queries } = createQueryRunner();

    await new MarketplaceOrderStatus1784333200000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('ALTER COLUMN "order_status" TYPE text');
    expect(sql).toContain(
      'DROP TYPE IF EXISTS "public"."orders_order_status_enum"',
    );
    expect(sql).toContain('CREATE TYPE "public"."orders_order_status_enum"');
    expect(sql).toContain("'submitted'");
    expect(sql).toContain("'approved_for_matching'");
    expect(sql).toContain("'file_rejected'");
    expect(sql).toContain("'production'");
    expect(sql).toContain("'out_for_delivery'");
    expect(sql).toContain("'collected_by_customer'");
    expect(sql).toContain("'issue_window_open'");
    expect(sql).toContain("'payment_authorized'");
    expect(sql).toContain("SET DEFAULT 'submitted'");
    // legacy remaps
    expect(sql).toMatch(/order_placed|SET "order_status"/);
    expect(queries.some((q) => q.includes('order_status_history'))).toBe(true);
  });

  it('skips when orders table is missing', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasTable: false });

    await new MarketplaceOrderStatus1784333200000().up(queryRunner);

    expect(queries).toHaveLength(0);
  });

  it('does not reverse on adopted baseline', async () => {
    const { queryRunner, queries } = createQueryRunner({
      ownership: 'adopted',
    });

    await new MarketplaceOrderStatus1784333200000().down(queryRunner);

    const sql = queries.join('\n');
    expect(sql).not.toContain('CREATE TYPE');
    expect(sql).not.toContain('DROP TYPE');
  });
});
