import type { QueryRunner } from 'typeorm';
import { HomeFeedPromoCards1784246500000 } from '../../migrations/1784246500000-home-feed-promo-cards';

describe('HomeFeedPromoCards1784246500000', () => {
  it('creates the cards table, moves configured legacy promo data, then drops the old columns', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as unknown as QueryRunner;

    await new HomeFeedPromoCards1784246500000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "home_feed_promo_cards"');
    expect(sql).toContain('"title" varchar(80) NOT NULL');
    expect(sql).toContain('"body" varchar(220)');
    expect(sql).toContain('"sort_order" int NOT NULL');
    expect(sql).toContain('"is_active" boolean NOT NULL DEFAULT true');
    expect(sql).toContain('INSERT INTO "home_feed_promo_cards"');
    expect(sql).toContain('"promo_title"');
    expect(sql).toContain('"promo_body"');
    expect(sql).toContain('"promo_cta_label"');
    expect(sql).toContain('"promo_cta_target"');
    expect(sql).toContain('"promo_image_url"');
    expect(sql).toContain(
      'nullif(btrim(settings."promo_title"), \'\') IS NOT NULL',
    );
    expect(sql).toContain(
      'nullif(btrim(settings."promo_body"), \'\') IS NOT NULL',
    );
    expect(sql).toContain("to_jsonb(settings) ->> 'promo_cta_label'");
    expect(sql).toContain('SELECT MIN(card."sort_order") - 1');
    expect(sql).toContain('IS NOT DISTINCT FROM');

    const insertIndex = queries.findIndex((query) =>
      query.includes('INSERT INTO "home_feed_promo_cards"'),
    );
    const firstDropIndex = queries.findIndex((query) =>
      query.includes('DROP COLUMN IF EXISTS'),
    );
    expect(insertIndex).toBeGreaterThan(0);
    expect(firstDropIndex).toBeGreaterThan(insertIndex);

    for (const column of [
      'promo_title',
      'promo_body',
      'promo_cta_label',
      'promo_cta_target',
      'promo_image_url',
    ]) {
      expect(sql).toContain(`DROP COLUMN IF EXISTS "${column}"`);
    }
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

    await new HomeFeedPromoCards1784246500000().down(queryRunner);

    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('SELECT "ownership"');
    expect(queries[0]).not.toContain('DROP TABLE');
    expect(queries[0]).not.toContain('ADD COLUMN');
  });
});
