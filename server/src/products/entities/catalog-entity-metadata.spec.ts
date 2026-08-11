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

  it('supports self-referential category hierarchy columns', () => {
    const columns = getMetadataArgsStorage().columns;
    const parentId = columns.find(
      (column) =>
        column.target === ProductCategory && column.propertyName === 'parentId',
    );
    const catalogLevel = columns.find(
      (column) =>
        column.target === ProductCategory &&
        column.propertyName === 'catalogLevel',
    );
    const isOrderable = columns.find(
      (column) =>
        column.target === ProductCategory &&
        column.propertyName === 'isOrderable',
    );
    const audienceLabel = columns.find(
      (column) =>
        column.target === ProductCategory &&
        column.propertyName === 'audienceLabel',
    );

    expect(parentId?.options.name).toBe('parent_id');
    expect(catalogLevel?.options.name).toBe('catalog_level');
    expect(isOrderable?.options.name).toBe('is_orderable');
    expect(audienceLabel?.options.name).toBe('audience_label');
  });
});
