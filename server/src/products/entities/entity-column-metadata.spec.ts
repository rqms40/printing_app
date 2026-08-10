import { getMetadataArgsStorage } from 'typeorm';

import { FileMetadata } from '../../files/entities/file-metadata.entity';
import { OrderItemSpecValue } from '../../orders/entities/order-item-spec-value.entity';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { Order, PricingStatus } from '../../orders/entities/order.entity';
import { SupplierCapability } from '../../suppliers/entities/supplier-capability.entity';
import { ProductCategory } from './product-category.entity';
import { ServiceAddon } from './service-addon.entity';
import { PricingModel } from '../enums/catalog.enums';

function columnOptions(target: object, propertyName: string) {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options;
}

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

  it('maps catalog groups and quote-required pricing', () => {
    expect(PricingModel.QUOTE_REQUIRED).toBe('quote_required');
    expect(columnOptions(ProductCategory, 'groupSlug')).toMatchObject({
      name: 'group_slug',
      type: 'varchar',
      nullable: true,
    });
    expect(columnOptions(ProductCategory, 'groupName')).toMatchObject({
      name: 'group_name',
      type: 'varchar',
      nullable: true,
    });
    expect(columnOptions(ProductCategory, 'groupDescription')).toMatchObject({
      name: 'group_description',
      type: 'text',
      nullable: true,
    });
    expect(columnOptions(ProductCategory, 'groupSortOrder')).toMatchObject({
      name: 'group_sort_order',
      type: 'int',
      nullable: true,
    });
    expect(columnOptions(ProductCategory, 'examples')).toMatchObject({
      type: 'jsonb',
      nullable: true,
    });
  });

  it('maps nullable RFQ quote metadata with an accepted legacy default', () => {
    expect(columnOptions(Order, 'pricingStatus')).toMatchObject({
      name: 'pricing_status',
      type: 'enum',
      enum: PricingStatus,
      enumName: 'orders_pricing_status_enum',
      default: PricingStatus.ACCEPTED,
    });

    for (const [propertyName, type] of [
      ['quotedTotalMinor', 'bigint'],
      ['quotedAt', 'timestamptz'],
      ['quoteAcceptedAt', 'timestamptz'],
      ['quotedByUserId', 'int'],
      ['promisedCompletionAt', 'timestamptz'],
    ] as const) {
      expect(columnOptions(Order, propertyName)).toMatchObject({
        type,
        nullable: true,
      });
    }
  });

  it('maps RFQ requirement and upload bindings and widened spec snapshots', () => {
    expect(columnOptions(OrderItem, 'requiredAt')).toMatchObject({
      name: 'required_at',
      type: 'timestamptz',
      nullable: true,
    });
    expect(columnOptions(FileMetadata, 'catalogProductSlug')).toMatchObject({
      name: 'catalog_product_slug',
      type: 'varchar',
      length: 50,
      nullable: true,
    });
    expect(columnOptions(OrderItemSpecValue, 'value')?.length).toBe(1000);
    expect(columnOptions(OrderItemSpecValue, 'displayValue')?.length).toBe(
      1000,
    );
  });

  it('enforces one capability record per supplier/product pair', () => {
    expect(columnOptions(SupplierCapability, 'isActive')).toMatchObject({
      name: 'is_active',
      type: 'boolean',
      default: true,
    });

    const unique = getMetadataArgsStorage().uniques.find(
      (entry) =>
        entry.target === SupplierCapability &&
        entry.name === 'uq_supplier_capability_product',
    );
    expect(unique?.columns).toEqual(['supplierId', 'productFamily']);
  });
});
