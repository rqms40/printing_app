import { getMetadataArgsStorage } from 'typeorm';
import { CodCollection } from './cod-collection.entity';

function columnType(propertyName: string): unknown {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === CodCollection && column.propertyName === propertyName,
  )?.options.type;
}

describe('CodCollection entity metadata', () => {
  it('maps to cod_collections table', () => {
    const table = getMetadataArgsStorage().tables.find(
      (t) => t.target === CodCollection,
    );
    expect(table?.name).toBe('cod_collections');
  });

  it('declares eligibility, amount minor, proof, and recon columns', () => {
    expect(columnType('orderId')).toBe('int');
    expect(columnType('riderId')).toBe('int');
    expect(columnType('eligible')).toBe('boolean');
    expect(columnType('eligibilityReason')).toBe('text');
    expect(columnType('amountMinor')).toBe('bigint');
    expect(columnType('status')).toBe('enum');
    expect(columnType('otpRef')).toBe('varchar');
    expect(columnType('photoFileId')).toBe('int');
    expect(columnType('receiptRefs')).toBe('jsonb');
    expect(columnType('collectedAt')).toBe('timestamptz');
    expect(columnType('failedAt')).toBe('timestamptz');
    expect(columnType('reconciledAt')).toBe('timestamptz');
    expect(columnType('discrepancyReason')).toBe('text');
    expect(columnType('returnReason')).toBe('text');
  });

  it('enforces one COD collection per order in entity metadata', () => {
    const index = getMetadataArgsStorage().indices.find(
      (candidate) =>
        candidate.target === CodCollection &&
        candidate.name === 'uq_cod_collections_order_id',
    );

    expect(index?.columns).toEqual(['orderId']);
    expect(index?.unique).toBe(true);
  });
});
