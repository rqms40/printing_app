import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { QueryRunner } from 'typeorm';

import { CatalogRfqV1101784334500000 } from '../../migrations/1784334500000-catalog-rfq-v1-10';

describe('CatalogRfqV1101784334500000', () => {
  function createQueryRunner(hasColumn = false) {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => true),
      hasColumn: jest.fn(async () => hasColumn),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as unknown as QueryRunner;

    return { queryRunner, queries };
  }

  it('contains every catalog RFQ schema contract', () => {
    const source = readFileSync(
      join(process.cwd(), 'migrations', '1784334500000-catalog-rfq-v1-10.ts'),
      'utf8',
    );

    expect(source).toContain('group_slug');
    expect(source).toContain('pricing_status');
    expect(source).toContain('quoted_total_minor');
    expect(source).toContain('required_at');
    expect(source).toContain('catalog_product_slug');
    expect(source).toContain('uq_supplier_capability_product');
  });

  it('adds nullable RFQ metadata and backfills historical orders as accepted', async () => {
    const { queryRunner, queries } = createQueryRunner();

    await new CatalogRfqV1101784334500000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('orders_pricing_status_enum');
    expect(sql).toContain("'pending_quote'");
    expect(sql).toContain("'quoted'");
    expect(sql).toContain("'accepted'");
    expect(sql).toContain('ADD COLUMN "quoted_total_minor" bigint');
    expect(sql).toContain('ADD COLUMN "quoted_by_user_id" integer');
    expect(sql).toContain('REFERENCES "users"("id")');
    expect(sql).toMatch(
      /UPDATE "orders"[\s\S]*"pricing_status" = 'accepted'[\s\S]*WHERE "pricing_status" IS NULL/,
    );
    expect(sql).toMatch(
      /ALTER COLUMN "pricing_status" SET DEFAULT 'accepted'[\s\S]*ALTER COLUMN "pricing_status" SET NOT NULL/,
    );
    expect(sql).toContain('TYPE varchar(1000)');
    expect(sql).toContain(`WHERE "slug" IN ('paper', '3d')`);
  });

  it('reverses each schema addition in dependency-safe order', async () => {
    const { queryRunner, queries } = createQueryRunner(true);

    await new CatalogRfqV1101784334500000().down(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain(
      'DROP CONSTRAINT IF EXISTS "uq_supplier_capability_product"',
    );
    expect(sql).toContain(
      'DROP CONSTRAINT IF EXISTS "fk_orders_quoted_by_user"',
    );
    expect(sql).toContain('DROP COLUMN "pricing_status"');
    expect(sql).toContain(
      'DROP TYPE IF EXISTS "public"."orders_pricing_status_enum"',
    );
    expect(sql).toContain('TYPE varchar(120)');
    expect(sql).toContain(
      `SET "is_active" = true WHERE "slug" IN ('paper', '3d')`,
    );
  });
});
