import type { QueryRunner } from 'typeorm';
import { OrderPaymentAuthorizationFields1784333300000 } from '../../migrations/1784333300000-order-payment-authorization-fields';

describe('OrderPaymentAuthorizationFields1784333300000', () => {
  function createQueryRunner(
    opts: {
      hasTable?: boolean;
      hasColumn?: boolean | ((name: string) => boolean);
      ownership?: string;
    } = {},
  ) {
    const { hasTable = true, hasColumn = false, ownership = 'baseline' } = opts;
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => hasTable),
      hasColumn: jest.fn(async (_table: string, column: string) => {
        if (typeof hasColumn === 'function') return hasColumn(column);
        return hasColumn;
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

  it('adds minor money, authorization status, codEligible, and snapshot columns', async () => {
    const { queryRunner, queries } = createQueryRunner();

    await new OrderPaymentAuthorizationFields1784333300000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('orders_payment_authorization_status_enum');
    expect(sql).toContain("'none'");
    expect(sql).toContain("'authorized'");
    expect(sql).toContain("'failed'");
    expect(sql).toContain("'expired'");
    expect(sql).toContain('"final_total_minor" bigint');
    expect(sql).toContain('"delivery_fee_minor" bigint');
    expect(sql).toContain('"payment_authorization_status"');
    expect(sql).toContain('"cod_eligible" boolean NOT NULL DEFAULT false');
    expect(sql).toContain('"authorization_snapshot" jsonb');
    // backfill from legacy majors
    expect(sql).toMatch(/ROUND\(COALESCE\("delivery_fee"/);
    expect(sql).toMatch(/COALESCE\("total_price"/);
  });

  it('is idempotent when columns already exist', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasColumn: true });

    await new OrderPaymentAuthorizationFields1784333300000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('to_regtype');
    expect(sql).not.toContain('ADD COLUMN "final_total_minor"');
    expect(sql).not.toContain('ADD COLUMN "authorization_snapshot"');
    // still backfills nulls
    expect(sql).toMatch(/UPDATE "orders"/);
  });

  it('skips when orders table is missing', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasTable: false });

    await new OrderPaymentAuthorizationFields1784333300000().up(queryRunner);

    expect(queries).toHaveLength(0);
  });

  it('does not drop columns on an adopted baseline', async () => {
    const { queryRunner, queries } = createQueryRunner({
      hasColumn: true,
      ownership: 'adopted',
    });

    await new OrderPaymentAuthorizationFields1784333300000().down(queryRunner);

    const sql = queries.join('\n');
    expect(sql).not.toContain('DROP COLUMN');
    expect(sql).not.toContain('DROP TYPE');
  });
});
