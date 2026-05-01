export enum DeliverySpeedTier {
  PRIORITY = 'priority',
  STANDARD = 'standard',
  SAVER = 'saver',
  SCHEDULED = 'scheduled',
}

export function isValidSpeedTier(value: string): value is DeliverySpeedTier {
  return (
    typeof value === 'string' &&
    (Object.values(DeliverySpeedTier) as string[]).includes(value)
  );
}
