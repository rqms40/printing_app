import { getMetadataArgsStorage } from 'typeorm';
import { DeliverySettings } from './delivery-settings.entity';

describe('DeliverySettings entity metadata', () => {
  const cols = getMetadataArgsStorage()
    .filterColumns(DeliverySettings)
    .map((c) => c.propertyName);

  it('has required columns', () => {
    for (const name of [
      'id',
      'serviceCenterLat',
      'serviceCenterLng',
      'serviceRadiusKm',
      'priorityFeeAmount',
      'deliveryFeePerKm',
      'extraDestinationSurcharge',
      'serviceFeePercent',
    ]) {
      expect(cols).toContain(name);
    }
  });
});
