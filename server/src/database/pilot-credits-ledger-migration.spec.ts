import type { QueryRunner } from 'typeorm';
import { PilotCreditsLedger1784333400000 } from '../../migrations/1784333400000-pilot-credits-ledger';

describe('PilotCreditsLedger1784333400000', () => {
  function createQueryRunner(opts: {
    hasTable?: boolean;
    hasColumn?: boolean | ((name: string) => boolean);
    ownership?: string;
  } = {}) {
    const {
      hasTable = true,
      hasColumn = false,
      ownership = 'baseline',
    } = opts;
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

  it('adds pilot ledger event types, audit columns, and idempotency index', async () => {
    const { queryRunner, queries } = createQueryRunner();

    await new PilotCreditsLedger1784333400000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain("'grant'");
    expect(sql).toContain("'reserve'");
    expect(sql).toContain("'spend'");
    expect(sql).toContain("'release'");
    expect(sql).toContain("'expire'");
    expect(sql).toContain("'manual_adjustment'");
    expect(sql).toContain('"idempotency_key"');
    expect(sql).toContain('"reason"');
    expect(sql).toContain('"expires_at"');
    expect(sql).toContain('"actor_user_id"');
    expect(sql).toContain('"balance_before"');
    expect(sql).toContain('"balance_after"');
    expect(sql).toContain('uq_credit_transactions_idempotency_key');
  });

  it('is idempotent when columns already exist', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasColumn: true });

    await new PilotCreditsLedger1784333400000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).not.toContain('ADD COLUMN "idempotency_key"');
    expect(sql).not.toContain('ADD COLUMN "reason"');
    expect(sql).toContain('uq_credit_transactions_idempotency_key');
  });

  it('skips when credit_transactions table is missing', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasTable: false });

    await new PilotCreditsLedger1784333400000().up(queryRunner);

    expect(queries).toHaveLength(0);
  });

  it('does not drop columns on an adopted baseline', async () => {
    const { queryRunner, queries } = createQueryRunner({
      hasColumn: true,
      ownership: 'adopted',
    });

    await new PilotCreditsLedger1784333400000().down(queryRunner);

    const sql = queries.join('\n');
    expect(sql).not.toContain('DROP COLUMN');
  });
});
