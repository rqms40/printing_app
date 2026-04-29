import { getMetadataArgsStorage } from 'typeorm';
import { DeliveryDestination } from './delivery-destination.entity';

describe('DeliveryDestination entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(DeliveryDestination)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'batchOrderId',
      'addressId',
      'label',
      'sortOrder',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
