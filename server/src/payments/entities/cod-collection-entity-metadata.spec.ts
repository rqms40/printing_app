import { getMetadataArgsStorage } from 'typeorm';
import { CodCollection } from './cod-collection.entity';

function columnType(
  target: Function,
  propertyName: string,
): string | Function | undefined {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options.type as string | Function | undefined;
}

describe('CodCollection entity metadata', () => {
  it('maps to cod_collections table', () => {
    const table = getMetadataArgsStorage().tables.find(
      (t) => t.target === CodCollection,
    );
    expect(table?.name).toBe('cod_collections');
  });

  it('declares eligibility, amount minor, proof, and recon columns', () => {
    expect(columnType(CodCollection, 'orderId')).toBe('int');
    expect(columnType(CodCollection, 'riderId')).toBe('int');
    expect(columnType(CodCollection, 'eligible')).toBe('boolean');
    expect(columnType(CodCollection, 'eligibilityReason')).toBe('text');
    expect(columnType(CodCollection, 'amountMinor')).toBe('bigint');
    expect(columnType(CodCollection, 'status')).toBe('enum');
    expect(columnType(CodCollection, 'otpRef')).toBe('varchar');
    expect(columnType(CodCollection, 'photoFileId')).toBe('int');
    expect(columnType(CodCollection, 'receiptRefs')).toBe('jsonb');
    expect(columnType(CodCollection, 'collectedAt')).toBe('timestamptz');
    expect(columnType(CodCollection, 'failedAt')).toBe('timestamptz');
    expect(columnType(CodCollection, 'reconciledAt')).toBe('timestamptz');
    expect(columnType(CodCollection, 'discrepancyReason')).toBe('text');
    expect(columnType(CodCollection, 'returnReason')).toBe('text');
  });
});
