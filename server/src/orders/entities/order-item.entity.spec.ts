import { getMetadataArgsStorage } from 'typeorm';
import { OrderItem } from './order-item.entity';

describe('OrderItem entity multi-destination metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(OrderItem)
    .map((c) => c.propertyName);

  it('has destinationId column', () => {
    expect(cols).toContain('destinationId');
  });
});
