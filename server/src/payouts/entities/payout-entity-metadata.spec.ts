import { getMetadataArgsStorage } from 'typeorm';
import { Payout } from './payout.entity';

function columnType(
  target: Function,
  propertyName: string,
): string | Function | undefined {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options.type as string | Function | undefined;
}

describe('Payout entity metadata', () => {
  it('maps to payouts table', () => {
    const table = getMetadataArgsStorage().tables.find(
      (t) => t.target === Payout,
    );
    expect(table?.name).toBe('payouts');
  });

  it('declares gross/commission/net minor units and settlement columns', () => {
    expect(columnType(Payout, 'supplierId')).toBe('int');
    expect(columnType(Payout, 'orderId')).toBe('int');
    expect(columnType(Payout, 'grossMinor')).toBe('bigint');
    expect(columnType(Payout, 'commissionMinor')).toBe('bigint');
    expect(columnType(Payout, 'netMinor')).toBe('bigint');
    expect(columnType(Payout, 'holdReason')).toBe('text');
    expect(columnType(Payout, 'holdExpiresAt')).toBe('timestamptz');
    expect(columnType(Payout, 'releaseAuthorityId')).toBe('int');
    expect(columnType(Payout, 'settlementState')).toBe('enum');
    expect(columnType(Payout, 'settlementReference')).toBe('varchar');
  });
});
