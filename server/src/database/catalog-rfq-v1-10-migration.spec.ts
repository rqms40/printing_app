import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { QueryRunner } from 'typeorm';

import { CatalogRfqV1101784334500000 } from '../../migrations/1784334500000-catalog-rfq-v1-10';

describe('CatalogRfqV1101784334500000', () => {
  type DuplicateCapabilityRow = {
    id: number;
    supplier_id: number;
    product_family: string;
    payload_signature: string;
  };

  function createQueryRunner(
    options: {
      hasColumn?: boolean;
      duplicateCapabilities?: DuplicateCapabilityRow[];
    } = {},
  ) {
    const { hasColumn = false, duplicateCapabilities = [] } = options;
    const queries: Array<{ sql: string; parameters?: unknown[] }> = [];
    const queryRunner = {
      hasTable: jest.fn(async () => true),
      hasColumn: jest.fn(async () => hasColumn),
      query: jest.fn(async (sql: string, parameters?: unknown[]) => {
        queries.push({ sql, parameters });
        if (sql.includes('payload_signature')) {
          return duplicateCapabilities;
        }
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
    expect(source).toContain('examples');
    expect(source).toContain('pricing_status');
    expect(source).toContain('quoted_total_minor');
    expect(source).toContain('required_at');
    expect(source).toContain('catalog_product_slug');
    expect(source).toContain('catalog_artwork');
    expect(source).toContain('uq_file_metadata_object_key');
    expect(source).toContain('pending_file_uploads');
    expect(source).toContain('idx_pending_file_uploads_due');
    expect(source).toContain('uq_supplier_capability_product');
  });

  it('adds nullable RFQ metadata and backfills historical orders as accepted', async () => {
    const { queryRunner, queries } = createQueryRunner();

    await new CatalogRfqV1101784334500000().up(queryRunner);

    const sql = queries.map((query) => query.sql).join('\n');
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
    expect(sql).toContain('ADD COLUMN "examples" jsonb');
    expect(sql).toContain(`WHERE "slug" IN ('paper', '3d')`);
  });

  it('preserves the lowest id when consolidating demonstrably identical capabilities', async () => {
    const signature =
      '{"is_active":true,"materials":["matte"],"max_capacity":10,"lead_time_days":2}';
    const { queryRunner, queries } = createQueryRunner({
      duplicateCapabilities: [
        {
          id: 9,
          supplier_id: 7,
          product_family: 'flyers',
          payload_signature: signature,
        },
        {
          id: 3,
          supplier_id: 7,
          product_family: 'flyers',
          payload_signature: signature,
        },
      ],
    });

    await new CatalogRfqV1101784334500000().up(queryRunner);

    const deleteIndex = queries.findIndex((query) =>
      query.sql.includes('DELETE FROM "supplier_capabilities"'),
    );
    const constraintIndex = queries.findIndex((query) =>
      query.sql.includes('ADD CONSTRAINT "uq_supplier_capability_product"'),
    );
    expect(deleteIndex).toBeGreaterThanOrEqual(0);
    expect(queries[deleteIndex]?.parameters).toEqual([[9]]);
    expect(constraintIndex).toBeGreaterThan(deleteIndex);
  });

  it('rejects conflicting capabilities with actionable pair and id details', async () => {
    const { queryRunner, queries } = createQueryRunner({
      duplicateCapabilities: [
        {
          id: 2,
          supplier_id: 6,
          product_family: 'brochures',
          payload_signature:
            '{"is_active":true,"materials":[],"max_capacity":5,"lead_time_days":2}',
        },
        {
          id: 4,
          supplier_id: 6,
          product_family: 'brochures',
          payload_signature:
            '{"is_active":true,"materials":[],"max_capacity":5,"lead_time_days":2}',
        },
        {
          id: 3,
          supplier_id: 7,
          product_family: 'flyers',
          payload_signature:
            '{"is_active":true,"materials":["matte"],"max_capacity":10,"lead_time_days":2}',
        },
        {
          id: 9,
          supplier_id: 7,
          product_family: 'flyers',
          payload_signature:
            '{"is_active":true,"materials":["glossy"],"max_capacity":25,"lead_time_days":1}',
        },
      ],
    });

    await expect(
      new CatalogRfqV1101784334500000().up(queryRunner),
    ).rejects.toThrow(
      'supplier_id=7, product_family="flyers", capability_ids=[3, 9]',
    );
    expect(
      queries.some((query) =>
        query.sql.includes('DELETE FROM "supplier_capabilities"'),
      ),
    ).toBe(false);
    expect(
      queries.some((query) =>
        query.sql.includes('ADD CONSTRAINT "uq_supplier_capability_product"'),
      ),
    ).toBe(false);
  });

  it('snapshots legacy activation state before deactivation', async () => {
    const { queryRunner, queries } = createQueryRunner();

    await new CatalogRfqV1101784334500000().up(queryRunner);

    const createSnapshotIndex = queries.findIndex((query) =>
      query.sql.includes(
        'CREATE TABLE IF NOT EXISTS "catalog_v1_10_legacy_activation_snapshot"',
      ),
    );
    const snapshotIndex = queries.findIndex((query) =>
      query.sql.includes(
        'INSERT INTO "catalog_v1_10_legacy_activation_snapshot"',
      ),
    );
    const deactivateIndex = queries.findIndex((query) =>
      query.sql.includes('SET "is_active" = false'),
    );
    expect(createSnapshotIndex).toBeGreaterThanOrEqual(0);
    expect(snapshotIndex).toBeGreaterThan(createSnapshotIndex);
    expect(queries[snapshotIndex]?.sql).toContain('SELECT "slug", "is_active"');
    expect(queries[snapshotIndex]?.sql).toContain(
      'ON CONFLICT ("slug") DO NOTHING',
    );
    expect(deactivateIndex).toBeGreaterThan(snapshotIndex);
  });

  it('reverses each schema addition in dependency-safe order', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasColumn: true });

    await new CatalogRfqV1101784334500000().down(queryRunner);

    const sql = queries.map((query) => query.sql).join('\n');
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
    expect(sql).toContain('activation_snapshot."was_active"');
    expect(sql).toContain('DROP COLUMN "examples"');
    expect(sql).toContain('DROP TABLE IF EXISTS "pending_file_uploads"');
    expect(sql).toContain(
      `CREATE TYPE "public"."file_metadata_purpose_enum" AS ENUM ('general', 'paper', 'proof_of_delivery', 'beta_testimonial', 'legacy')`,
    );
    expect(sql).toMatch(
      /UPDATE "file_metadata"[\s\S]*SET "purpose" = 'general'[\s\S]*WHERE "purpose"::text = 'catalog_artwork'/,
    );
    expect(sql).toMatch(
      /ALTER TYPE "public"\."file_metadata_purpose_enum"\s+RENAME TO "file_metadata_purpose_enum_with_catalog"/,
    );
    expect(sql).toContain('ALTER COLUMN "purpose" SET DEFAULT \'general\'');
    expect(sql).toContain(
      'DROP TYPE "public"."file_metadata_purpose_enum_with_catalog"',
    );
    expect(sql).not.toContain('SET "is_active" = true');

    const indexOf = (fragment: string) =>
      queries.findIndex((query) => query.sql.includes(fragment));
    expect(
      indexOf('DROP INDEX IF EXISTS "idx_orders_pricing_status"'),
    ).toBeLessThan(indexOf('DROP COLUMN "pricing_status"'));
    expect(
      indexOf('DROP CONSTRAINT IF EXISTS "fk_orders_quoted_by_user"'),
    ).toBeLessThan(indexOf('DROP COLUMN "quoted_by_user_id"'));
    expect(indexOf('DROP COLUMN "pricing_status"')).toBeLessThan(
      indexOf('DROP TYPE IF EXISTS "public"."orders_pricing_status_enum"'),
    );
    expect(indexOf('activation_snapshot."was_active"')).toBeLessThan(
      indexOf('DROP TABLE "catalog_v1_10_legacy_activation_snapshot"'),
    );
    expect(sql.indexOf('ALTER COLUMN "purpose" DROP DEFAULT')).toBeLessThan(
      sql.indexOf('RENAME TO "file_metadata_purpose_enum_with_catalog"'),
    );
    expect(sql.indexOf('SET "purpose" = \'general\'')).toBeLessThan(
      sql.indexOf('RENAME TO "file_metadata_purpose_enum_with_catalog"'),
    );
    expect(
      indexOf('DROP INDEX IF EXISTS "uq_file_metadata_object_key"'),
    ).toBeLessThan(indexOf('DROP COLUMN "catalog_product_slug"'));
  });
});
