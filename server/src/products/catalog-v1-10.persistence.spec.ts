import { CATALOG_V1_10_GROUPS } from './catalog-v1-10.definition';
import {
  type CatalogSqlExecutor,
  upsertCatalogV110,
} from './catalog-v1-10.persistence';

describe('upsertCatalogV110', () => {
  class RecordingExecutor implements CatalogSqlExecutor {
    readonly queries: Array<{ sql: string; parameters: unknown[] }> = [];

    async query<T = unknown>(
      sql: string,
      parameters: unknown[] = [],
    ): Promise<T> {
      this.queries.push({ sql, parameters });
      return [] as T;
    }
  }

  it('persists the exact four-group, seventeen-leaf RFQ definition without deleting historical categories', async () => {
    const executor = new RecordingExecutor();

    await upsertCatalogV110(executor);

    const categoryUpserts = executor.queries.filter((query) =>
      query.sql.includes('INSERT INTO "product_categories"'),
    );
    expect(categoryUpserts).toHaveLength(17);
    expect(categoryUpserts[0]?.sql).toContain('ON CONFLICT ("slug")');
    expect(categoryUpserts[0]?.parameters).toEqual([
      'flyers',
      'Flyers',
      'Single sheets, event promos, and product announcements.',
      'Single sheets, event promos, and product announcements.',
      'marketing-promo',
      'Marketing & Promotional Collateral',
      'Best for businesses, startups, and events looking to promote services or distribute physical marketing material.',
      1,
      'document',
      'quote_required',
      0,
      'copy',
      100,
      '["pdf","png","jpg","jpeg","tif","tiff","ai","psd"]',
      true,
      1,
    ]);
    expect(categoryUpserts.at(-1)?.parameters.slice(0, 7)).toEqual([
      'packaging-box-production',
      'Packaging & Box Production',
      'Custom product boxes, mailer boxes, and food-grade packaging.',
      'Custom product boxes, mailer boxes, and food-grade packaging.',
      'specialized-prototyping',
      'Specialized & Prototyping Services',
      'Best for architecture students, engineers, industrial designers, and specialized builds.',
    ]);

    const specUpserts = executor.queries.filter((query) =>
      query.sql.includes('INSERT INTO "product_spec_definitions"'),
    );
    expect(specUpserts).toHaveLength(83);
    expect(specUpserts[0]?.sql).toContain('ON CONFLICT ("category_id", "key")');
    expect(specUpserts[0]?.parameters.slice(0, 8)).toEqual([
      'flyers',
      'dimensions_or_standard_size',
      'Dimensions or standard size',
      null,
      'text',
      'string',
      true,
      true,
    ]);

    const sql = executor.queries.map((query) => query.sql).join('\n');
    expect(sql).toContain('UPDATE "product_spec_options"');
    expect(sql).toContain('UPDATE "product_spec_definitions"');
    expect(sql).toContain(`"slug" IN ('paper', '3d')`);
    expect(sql).not.toContain('DELETE FROM "product_categories"');

    expect(CATALOG_V1_10_GROUPS).toHaveLength(4);
  });

  it('uses conflict-safe category, specification, and option writes on every run', async () => {
    const executor = new RecordingExecutor();

    await upsertCatalogV110(executor);
    const firstRun = [...executor.queries];
    executor.queries.length = 0;
    await upsertCatalogV110(executor);

    expect(executor.queries).toEqual(firstRun);
    expect(
      executor.queries
        .filter((query) => query.sql.includes('INSERT INTO'))
        .every((query) => query.sql.includes('ON CONFLICT')),
    ).toBe(true);
  });
});
