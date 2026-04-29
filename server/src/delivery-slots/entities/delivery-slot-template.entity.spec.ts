import { getMetadataArgsStorage } from 'typeorm';
import { DeliverySlotTemplate } from './delivery-slot-template.entity';

describe('DeliverySlotTemplate entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(DeliverySlotTemplate)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'dayOfWeek',
      'startTime',
      'endTime',
      'capacity',
      'isActive',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
