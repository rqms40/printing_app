import { getMetadataArgsStorage } from 'typeorm';
import { DeliverySlotBooking } from './delivery-slot-booking.entity';

describe('DeliverySlotBooking entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(DeliverySlotBooking)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'slotTemplateId',
      'date',
      'batchOrderId',
      'priority',
      'priorityRank',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
