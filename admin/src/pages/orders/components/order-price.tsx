import { Tag, Typography } from 'antd';
import type { PricingStatus } from '@/types/order';

const { Text } = Typography;

export function formatMinorCurrency(minor: string | number | bigint | null | undefined): string | null {
  if (minor == null || minor === '') return null;
  let value: bigint;
  try {
    value = typeof minor === 'bigint' ? minor : BigInt(String(minor));
  } catch {
    return null;
  }
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const pesos = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}₱${pesos}.${cents}`;
}

export function OrderPrice({
  pricingStatus,
  minor,
  legacyAmount,
}: {
  pricingStatus?: PricingStatus;
  minor?: string | null;
  legacyAmount?: number | null;
}) {
  if (pricingStatus === 'pending_quote') {
    return <Tag color="gold">Price pending quote</Tag>;
  }
  const formatted = formatMinorCurrency(minor);
  if (formatted) {
    return <Text strong>{formatted}</Text>;
  }
  if (legacyAmount != null) {
    return <Text strong>{`₱${legacyAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Text>;
  }
  return <Text type="secondary">Price unavailable</Text>;
}
