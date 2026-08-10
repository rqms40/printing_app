import type { QueryRunner } from 'typeorm';
import { ClientAccountType1784333100000 } from '../../migrations/1784333100000-client-account-type';

describe('ClientAccountType1784333100000', () => {
  function createQueryRunner(
    opts: {
      hasTable?: boolean;
      hasColumn?: boolean;
      ownership?: string;
    } = {},
  ) {
    const { hasTable = true, hasColumn = false, ownership = 'baseline' } = opts;
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => hasTable),
      hasColumn: jest.fn(async () => hasColumn),
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

  it('creates the enum and nullable client_account_type column', async () => {
    const { queryRunner, queries } = createQueryRunner();

    await new ClientAccountType1784333100000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('users_client_account_type_enum');
    expect(sql).toContain("'business'");
    expect(sql).toContain("'organization'");
    expect(sql).toContain("'teacher'");
    expect(sql).toContain('client_account_type');
    expect(sql).toMatch(/ADD COLUMN "client_account_type"/);
    expect(sql).toMatch(/NULL/);
  });

  it('is idempotent when column already exists', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasColumn: true });

    await new ClientAccountType1784333100000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('to_regtype');
    expect(sql).not.toContain('ADD COLUMN "client_account_type"');
  });

  it('skips when users table is missing', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasTable: false });

    await new ClientAccountType1784333100000().up(queryRunner);

    expect(queries).toHaveLength(0);
  });

  it('does not drop columns on an adopted baseline', async () => {
    const { queryRunner, queries } = createQueryRunner({
      hasColumn: true,
      ownership: 'adopted',
    });

    await new ClientAccountType1784333100000().down(queryRunner);

    const sql = queries.join('\n');
    // isBaselineOwned short-circuits adopted DBs — no DROP COLUMN / DROP TYPE
    expect(sql).not.toContain('DROP COLUMN');
    expect(sql).not.toContain('DROP TYPE');
  });
});
