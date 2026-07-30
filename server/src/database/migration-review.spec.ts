import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { QueryRunner } from 'typeorm';
import { DynamicProductCatalog1777680000000 } from '../../migrations/1777680000000-dynamic-product-catalog';
import { AddMarketingNotificationImageUrl1784160000000 } from '../../migrations/1784160000000-add-marketing-notification-image-url';

describe('migration review contracts', () => {
  it('adds the nullable marketing notification image URL column', async () => {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => true),
      hasColumn: jest.fn(async () => false),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as unknown as QueryRunner;

    await new AddMarketingNotificationImageUrl1784160000000().up(queryRunner);

    expect(queries).toEqual([
      'ALTER TABLE "marketing_notifications" ADD COLUMN "image_url" varchar(2048)',
    ]);
  });

  it('preserves legacy product and order specification tables', async () => {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => true),
      hasColumn: jest.fn(async () => true),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as unknown as QueryRunner;

    await new DynamicProductCatalog1777680000000().up(queryRunner);

    const sql = queries.join('\n');
    for (const table of [
      'paper_specs',
      'three_d_specs',
      'spec_options',
      'service_categories',
    ]) {
      expect(sql).not.toContain(`DROP TABLE "${table}"`);
    }
  });

  it('ships a compiled migration command and gates production API startup', () => {
    const serverRoot = join(__dirname, '..', '..');
    const packageJson = JSON.parse(
      readFileSync(join(serverRoot, 'package.json'), 'utf8'),
    ) as { scripts?: Record<string, string> };
    const dockerfile = readFileSync(join(serverRoot, 'Dockerfile'), 'utf8');
    const compose = readFileSync(
      join(serverRoot, 'docker-compose.yml'),
      'utf8',
    );

    expect(packageJson.scripts?.['migration:run:prod']).toBe(
      'typeorm migration:run -d dist/src/database/data-source.js',
    );
    expect(dockerfile).toContain('COPY --from=builder /app/dist ./dist');
    expect(compose).toContain('migrate:');
    expect(compose).toContain('command: npm run migration:run:prod');
    expect(compose).toMatch(
      /api:[\s\S]*depends_on:[\s\S]*migrate:[\s\S]*condition: service_completed_successfully/,
    );
    expect(compose).toMatch(
      /api:[\s\S]*environment:[\s\S]*MINIO_ENDPOINT: minio/,
    );
    expect(compose).not.toContain('seed:if-empty');
  });
});
