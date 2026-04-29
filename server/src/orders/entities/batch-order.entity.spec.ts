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

import { Order } from './order.entity';

describe('Order entity multi-destination', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(Order)
    .map((c) => c.propertyName);

  it('has destinationId column', () => {
    expect(cols).toContain('destinationId');
  });
});
