import { getMetadataArgsStorage } from 'typeorm';

import { ProductCategory } from './product-category.entity';
import { ProductSpecDefinition } from './product-spec-definition.entity';
import { ProductSpecOption } from './product-spec-option.entity';
import { ServiceAddon } from './service-addon.entity';

describe('catalog entity metadata', () => {
  it('maps catalog entities to first-class product tables', () => {
    const tables = getMetadataArgsStorage().tables;

    expect(tables.find((table) => table.target === ProductCategory)?.name).toBe(
      'product_categories',
    );
    expect(
      tables.find((table) => table.target === ProductSpecDefinition)?.name,
    ).toBe('product_spec_definitions');
    expect(
      tables.find((table) => table.target === ProductSpecOption)?.name,
    ).toBe('product_spec_options');
  });

  it('keeps product addon category references on product_categories', () => {
    const relations = getMetadataArgsStorage().relations;
    const categoryRelation = relations.find(
      (relation) =>
        relation.target === ServiceAddon &&
        relation.propertyName === 'category',
    );

    expect(categoryRelation?.type()).toBe(ProductCategory);
  });
});
