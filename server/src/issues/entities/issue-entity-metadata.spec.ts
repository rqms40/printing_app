import { getMetadataArgsStorage } from 'typeorm';
import { Issue } from './issue.entity';

function columnType(
  target: Function,
  propertyName: string,
): string | Function | undefined {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options.type as string | Function | undefined;
}

describe('Issue entity metadata', () => {
  it('maps to issues table', () => {
    const table = getMetadataArgsStorage().tables.find(
      (t) => t.target === Issue,
    );
    expect(table?.name).toBe('issues');
  });

  it('declares claim, money, and payout-impact columns', () => {
    expect(columnType(Issue, 'orderId')).toBe('int');
    expect(columnType(Issue, 'category')).toBe('varchar');
    expect(columnType(Issue, 'evidence')).toBe('jsonb');
    expect(columnType(Issue, 'deadline')).toBe('timestamptz');
    expect(columnType(Issue, 'status')).toBe('enum');
    expect(columnType(Issue, 'payoutImpact')).toBe('enum');
    expect(columnType(Issue, 'refundAmountMinor')).toBe('bigint');
    expect(columnType(Issue, 'adjustmentAmountMinor')).toBe('bigint');
    expect(columnType(Issue, 'openedByUserId')).toBe('int');
    expect(columnType(Issue, 'withinWindow')).toBe('boolean');
  });
});
