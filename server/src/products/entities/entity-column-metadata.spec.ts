import { getMetadataArgsStorage } from 'typeorm';

import { ServiceAddon } from './service-addon.entity';
import { ServiceCategory } from './service-category.entity';

describe('product entity column metadata', () => {
  it('declares explicit database types for nullable union columns', () => {
    const columns = getMetadataArgsStorage().columns;

    const serviceCategoryIcon = columns.find(
      (column) =>
        column.target === ServiceCategory && column.propertyName === 'icon',
    );
    const serviceAddonCategoryId = columns.find(
      (column) =>
        column.target === ServiceAddon && column.propertyName === 'categoryId',
    );

    expect(serviceCategoryIcon?.options.type).toBe('varchar');
    expect(serviceAddonCategoryId?.options.type).toBe('int');
  });
});
