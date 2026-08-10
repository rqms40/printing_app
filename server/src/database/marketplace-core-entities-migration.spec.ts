import type { QueryRunner } from 'typeorm';
import { MarketplaceCoreEntities1784333000000 } from '../../migrations/1784333000000-marketplace-core-entities';

describe('MarketplaceCoreEntities1784333000000', () => {
  function createQueryRunner(hasTable = false) {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => hasTable),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as unknown as QueryRunner & { queries: string[] };
    return { queryRunner, queries };
  }

  it('creates all marketplace core tables with money minor units', async () => {
    const { queryRunner, queries } = createQueryRunner(false);

    await new MarketplaceCoreEntities1784333000000().up(queryRunner);

    const sql = queries.join('\n');

    for (const table of [
      'quality_reviews',
      'supplier_assignments',
      'issues',
      'payouts',
      'cod_collections',
      'audit_events',
    ]) {
      expect(sql).toContain(`CREATE TABLE "${table}"`);
    }

    // Money as bigint PHP minor units
    expect(sql).toContain('"final_price_minor" bigint');
    expect(sql).toContain('"gross_minor" bigint NOT NULL');
    expect(sql).toContain('"commission_minor" bigint NOT NULL');
    expect(sql).toContain('"net_minor" bigint NOT NULL');
    expect(sql).toContain('"amount_minor" bigint NOT NULL');
    expect(sql).toContain('"refund_amount_minor" bigint');
    expect(sql).toContain('"adjustment_amount_minor" bigint');

    // Key enums
    expect(sql).toContain('quality_reviews_decision_enum');
    expect(sql).toContain('approved_for_matching');
    expect(sql).toContain('supplier_assignments_decision_enum');
    expect(sql).toContain('payouts_settlement_state_enum');
    expect(sql).toContain('cod_collections_status_enum');
    expect(sql).toContain('issues_status_enum');

    // FKs
    expect(sql).toContain('REFERENCES "orders"("id")');
    expect(sql).toContain('REFERENCES "supplier_profiles"("id")');
    expect(sql).toContain('REFERENCES "rider_profiles"("id")');
    expect(sql).toContain('REFERENCES "users"("id")');

    // Audit idempotency partial unique index
    expect(sql).toContain('uq_audit_events_idempotency_key');
    expect(sql).toContain('WHERE "idempotency_key" IS NOT NULL');
  });

  it('is idempotent when tables already exist', async () => {
    const { queryRunner, queries } = createQueryRunner(true);

    await new MarketplaceCoreEntities1784333000000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('to_regtype');
    expect(sql).not.toContain('CREATE TABLE "quality_reviews"');
    expect(sql).not.toContain('CREATE TABLE "audit_events"');
  });

  it('does not roll back an adopted baseline schema', async () => {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => true),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [{ ownership: 'adopted' }];
      }),
    } as unknown as QueryRunner;

    await new MarketplaceCoreEntities1784333000000().down(queryRunner);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('SELECT "ownership"');
    expect(queries.join('\n')).not.toContain('DROP TABLE');
  });

  it('drops tables and enums when baseline is owned', async () => {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => true),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [{ ownership: 'owned' }];
      }),
    } as unknown as QueryRunner;

    await new MarketplaceCoreEntities1784333000000().down(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('DROP TABLE IF EXISTS "audit_events"');
    expect(sql).toContain('DROP TABLE IF EXISTS "cod_collections"');
    expect(sql).toContain('DROP TABLE IF EXISTS "payouts"');
    expect(sql).toContain('DROP TABLE IF EXISTS "issues"');
    expect(sql).toContain('DROP TABLE IF EXISTS "supplier_assignments"');
    expect(sql).toContain('DROP TABLE IF EXISTS "quality_reviews"');
    expect(sql).toContain(
      'DROP TYPE IF EXISTS "public"."quality_reviews_decision_enum"',
    );
  });
});
