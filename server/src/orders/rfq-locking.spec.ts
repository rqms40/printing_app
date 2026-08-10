import { BadRequestException } from '@nestjs/common';

import {
  RFQ_CATEGORY_LOCK_SQL,
  RFQ_OPTION_LOCK_SQL,
  RFQ_SPEC_LOCK_SQL,
  assertUnambiguousArtworkProducts,
  lockRfqCatalog,
  resolveArtworkInLockOrder,
} from './rfq-locking';

describe('RFQ deterministic locking', () => {
  it('uses join-free, deterministically ordered PostgreSQL row locks', async () => {
    const queries: Array<[string, unknown[]]> = [];
    const manager = {
      query: jest.fn(async (sql: string, parameters: unknown[]) => {
        queries.push([sql, parameters]);
        if (sql === RFQ_CATEGORY_LOCK_SQL)
          return [
            { id: 2, slug: 'apparel' },
            { id: 1, slug: 'flyers' },
          ];
        if (sql === RFQ_SPEC_LOCK_SQL)
          return [
            { id: 10, category_id: 1 },
            { id: 20, category_id: 2 },
          ];
        return [
          { id: 100, spec_definition_id: 10 },
          { id: 200, spec_definition_id: 20 },
        ];
      }),
      getRepository: jest.fn((entity: { name: string }) => ({
        findBy: jest.fn(async () => {
          if (entity.name === 'ProductCategory')
            return [
              { id: 1, slug: 'flyers' },
              { id: 2, slug: 'apparel' },
            ];
          if (entity.name === 'ProductSpecDefinition')
            return [
              { id: 10, categoryId: 1 },
              { id: 20, categoryId: 2 },
            ];
          return [
            { id: 100, specDefinitionId: 10 },
            { id: 200, specDefinitionId: 20 },
          ];
        }),
      })),
    };

    const result = await lockRfqCatalog(manager as never, [
      'flyers',
      'apparel',
      'flyers',
    ]);

    expect(queries.map(([sql]) => sql)).toEqual([
      RFQ_CATEGORY_LOCK_SQL,
      RFQ_SPEC_LOCK_SQL,
      RFQ_OPTION_LOCK_SQL,
    ]);
    expect(queries[0][1]).toEqual([['apparel', 'flyers']]);
    for (const [sql] of queries) {
      expect(sql).toContain('ORDER BY');
      expect(sql).toContain('FOR UPDATE');
      expect(sql).not.toMatch(/\bJOIN\b/i);
    }
    expect(result.get('flyers')?.specs[0].options[0].id).toBe(100);
  });

  it('deduplicates artwork and resolves unique files in numeric order', async () => {
    const calls: number[] = [];
    const result = await resolveArtworkInLockOrder(
      [
        { fileMetadataId: 42, categorySlug: 'flyers' },
        { fileMetadataId: 41, categorySlug: 'flyers' },
        { fileMetadataId: 42, categorySlug: 'flyers' },
      ],
      async ({ fileMetadataId }) => {
        calls.push(fileMetadataId);
        return `file-${fileMetadataId}`;
      },
    );
    expect(calls).toEqual([41, 42]);
    expect(result.get(42)).toBe('file-42');
  });

  it('rejects one artwork id mapped to conflicting products before resolving', async () => {
    const inputs = [
      { fileMetadataId: 41, categorySlug: 'flyers' },
      { fileMetadataId: 41, categorySlug: 'apparel' },
    ];
    expect(() => assertUnambiguousArtworkProducts(inputs)).toThrow(
      BadRequestException,
    );
    const resolve = jest.fn();
    await expect(resolveArtworkInLockOrder(inputs, resolve)).rejects.toThrow(
      BadRequestException,
    );
    expect(resolve).not.toHaveBeenCalled();
  });
});
