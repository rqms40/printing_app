import { getMetadataArgsStorage } from 'typeorm';

import { ProductCategory } from './product-category.entity';
import { ServiceAddon } from './service-addon.entity';

describe('product entity column metadata', () => {
  it('declares explicit database types for nullable union columns', () => {
    const columns = getMetadataArgsStorage().columns;

    const productCategoryIcon = columns.find(
      (column) =>
        column.target === ProductCategory && column.propertyName === 'icon',
    );
    const serviceAddonCategoryId = columns.find(
      (column) =>
        column.target === ServiceAddon && column.propertyName === 'categoryId',
    );

    expect(productCategoryIcon?.options.type).toBe('varchar');
    expect(serviceAddonCategoryId?.options.type).toBe('int');
  });
});
