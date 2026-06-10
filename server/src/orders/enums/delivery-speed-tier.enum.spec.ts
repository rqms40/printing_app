import {
  DeliverySpeedTier,
  isValidSpeedTier,
} from './delivery-speed-tier.enum';

describe('DeliverySpeedTier', () => {
  it('exposes 4 canonical tiers', () => {
    expect(Object.values(DeliverySpeedTier).sort()).toEqual([
      'priority',
      'saver',
      'scheduled',
      'standard',
    ]);
  });

  it('isValidSpeedTier accepts known tiers', () => {
    expect(isValidSpeedTier('standard')).toBe(true);
    expect(isValidSpeedTier('priority')).toBe(true);
    expect(isValidSpeedTier('saver')).toBe(true);
    expect(isValidSpeedTier('scheduled')).toBe(true);
  });

  it('isValidSpeedTier rejects unknown values', () => {
    expect(isValidSpeedTier('express')).toBe(false);
    expect(isValidSpeedTier('')).toBe(false);
    expect(isValidSpeedTier(null as unknown as string)).toBe(false);
  });
});
