import { getMetadataArgsStorage } from 'typeorm';
import { BatchOrder } from './batch-order.entity';

describe('BatchOrder entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(BatchOrder)
    .map((c) => c.propertyName);

  it('has new delivery columns', () => {
    for (const name of [
      'deliveryType',
      'slotBookingId',
      'priorityFee',
      'extraDestinationFee',
      'externalDeliveryStatus',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
