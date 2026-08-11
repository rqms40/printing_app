import { BadRequestException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';

import { ProductCategory } from '../products/entities/product-category.entity';
import { ProductSpecDefinition } from '../products/entities/product-spec-definition.entity';
import { ProductSpecOption } from '../products/entities/product-spec-option.entity';

export const RFQ_CATEGORY_LOCK_SQL = `
  SELECT id, slug
  FROM product_categories
  WHERE slug = ANY($1::text[])
  ORDER BY slug ASC, id ASC
  FOR UPDATE
`;

export const RFQ_SPEC_LOCK_SQL = `
  SELECT id, category_id
  FROM product_spec_definitions
  WHERE category_id = ANY($1::int[])
  ORDER BY category_id ASC, id ASC
  FOR UPDATE
`;

export const RFQ_OPTION_LOCK_SQL = `
  SELECT id, spec_definition_id
  FROM product_spec_options
  WHERE spec_definition_id = ANY($1::int[])
  ORDER BY spec_definition_id ASC, id ASC
  FOR UPDATE
`;

type IdRow = { id: number | string };

export async function lockRfqCatalog(
  manager: EntityManager,
  categorySlugs: string[],
): Promise<Map<string, ProductCategory>> {
  const slugs = [...new Set(categorySlugs)].sort();
  const categoryRows = await manager.query<Array<IdRow & { slug: string }>>(
    RFQ_CATEGORY_LOCK_SQL,
    [slugs],
  );
  const categoryIds = categoryRows.map(({ id }) => Number(id));

  const categories = categoryIds.length
    ? await manager.getRepository(ProductCategory).findBy({
        id: In(categoryIds),
      })
    : [];

  const specRows = categoryIds.length
    ? await manager.query<Array<IdRow & { category_id: number | string }>>(
        RFQ_SPEC_LOCK_SQL,
        [categoryIds],
      )
    : [];
  const specIds = specRows.map(({ id }) => Number(id));
  const specs = specIds.length
    ? await manager.getRepository(ProductSpecDefinition).findBy({
        id: In(specIds),
      })
    : [];

  const optionRows = specIds.length
    ? await manager.query<
        Array<IdRow & { spec_definition_id: number | string }>
      >(RFQ_OPTION_LOCK_SQL, [specIds])
    : [];
  const optionIds = optionRows.map(({ id }) => Number(id));
  const options = optionIds.length
    ? await manager.getRepository(ProductSpecOption).findBy({
        id: In(optionIds),
      })
    : [];

  const optionsBySpec = new Map<number, ProductSpecOption[]>();
  for (const option of options.sort((a, b) => a.id - b.id)) {
    if (!option.isActive) continue;
    const list = optionsBySpec.get(option.specDefinitionId) ?? [];
    list.push(option);
    optionsBySpec.set(option.specDefinitionId, list);
  }
  const specsByCategory = new Map<number, ProductSpecDefinition[]>();
  for (const spec of specs.sort((a, b) => a.id - b.id)) {
    spec.options = optionsBySpec.get(spec.id) ?? [];
    if (!spec.isActive) continue;
    const list = specsByCategory.get(spec.categoryId) ?? [];
    list.push(spec);
    specsByCategory.set(spec.categoryId, list);
  }

  const bySlug = new Map<string, ProductCategory>();
  for (const category of categories) {
    category.specs = specsByCategory.get(category.id) ?? [];
    bySlug.set(category.slug, category);
  }
  return bySlug;
}

export type ArtworkLockInput = {
  fileMetadataId: number;
  categorySlug: string;
};

export function assertUnambiguousArtworkProducts(inputs: ArtworkLockInput[]) {
  const productByFile = new Map<number, string>();
  for (const input of inputs) {
    const existing = productByFile.get(input.fileMetadataId);
    if (existing && existing !== input.categorySlug) {
      throw new BadRequestException({
        code: 'ARTWORK_PRODUCT_CONFLICT',
        message: `Artwork ${input.fileMetadataId} cannot be used for multiple products`,
      });
    }
    productByFile.set(input.fileMetadataId, input.categorySlug);
  }
}

export async function resolveArtworkInLockOrder<T>(
  inputs: ArtworkLockInput[],
  resolve: (input: ArtworkLockInput) => Promise<T>,
): Promise<Map<number, T>> {
  assertUnambiguousArtworkProducts(inputs);
  const unique = new Map<number, ArtworkLockInput>();
  for (const input of inputs) unique.set(input.fileMetadataId, input);
  const ordered = [...unique.values()].sort(
    (a, b) =>
      a.fileMetadataId - b.fileMetadataId ||
      a.categorySlug.localeCompare(b.categorySlug),
  );
  const result = new Map<number, T>();
  for (const input of ordered) {
    result.set(input.fileMetadataId, await resolve(input));
  }
  return result;
}
