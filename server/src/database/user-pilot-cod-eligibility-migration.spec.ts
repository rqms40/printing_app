import type { QueryRunner } from 'typeorm';
import { UserPilotCodEligibility1784333600000 } from '../../migrations/1784333600000-user-pilot-cod-eligibility';

describe('UserPilotCodEligibility1784333600000', () => {
  function createQueryRunner(
    opts: {
      hasTable?: boolean;
      existingColumns?: string[];
      ownership?: string;
    } = {},
  ) {
    const {
      hasTable = true,
      existingColumns = [],
      ownership = 'baseline',
    } = opts;
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => hasTable),
      hasColumn: jest.fn(async (_table: string, column: string) =>
        existingColumns.includes(column),
      ),
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

  it('adds pilot_cod_eligible and cod_ops_risk_blocked defaults', async () => {
    const { queryRunner, queries } = createQueryRunner();

    await new UserPilotCodEligibility1784333600000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain(
      '"pilot_cod_eligible" boolean NOT NULL DEFAULT false',
    );
    expect(sql).toContain(
      '"cod_ops_risk_blocked" boolean NOT NULL DEFAULT false',
    );
  });

  it('is idempotent when columns already exist', async () => {
    const { queryRunner, queries } = createQueryRunner({
      existingColumns: ['pilot_cod_eligible', 'cod_ops_risk_blocked'],
    });

    await new UserPilotCodEligibility1784333600000().up(queryRunner);

    expect(queries).toHaveLength(0);
  });

  it('skips when users table is missing', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasTable: false });

    await new UserPilotCodEligibility1784333600000().up(queryRunner);

    expect(queries).toHaveLength(0);
  });

  it('does not drop columns on an adopted baseline', async () => {
    const { queryRunner, queries } = createQueryRunner({
      existingColumns: ['pilot_cod_eligible', 'cod_ops_risk_blocked'],
      ownership: 'adopted',
    });

    await new UserPilotCodEligibility1784333600000().down(queryRunner);

    const sql = queries.join('\n');
    expect(sql).not.toContain('DROP COLUMN');
  });
});
