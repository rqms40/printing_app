import { getMetadataArgsStorage } from 'typeorm';
import { SupplierAssignment } from './supplier-assignment.entity';

function columnType(
  target: Function,
  propertyName: string,
): string | Function | undefined {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options.type as string | Function | undefined;
}

describe('SupplierAssignment entity metadata', () => {
  it('maps to supplier_assignments table', () => {
    const table = getMetadataArgsStorage().tables.find(
      (t) => t.target === SupplierAssignment,
    );
    expect(table?.name).toBe('supplier_assignments');
  });

  it('declares ranking, SLA, and money columns in minor units', () => {
    expect(columnType(SupplierAssignment, 'orderId')).toBe('int');
    expect(columnType(SupplierAssignment, 'supplierId')).toBe('int');
    expect(columnType(SupplierAssignment, 'rankingInputs')).toBe('jsonb');
    expect(columnType(SupplierAssignment, 'rankPosition')).toBe('int');
    expect(columnType(SupplierAssignment, 'acceptanceDeadline')).toBe(
      'timestamptz',
    );
    expect(columnType(SupplierAssignment, 'decision')).toBe('enum');
    expect(columnType(SupplierAssignment, 'finalPriceMinor')).toBe('bigint');
    expect(columnType(SupplierAssignment, 'quotedPriceMinor')).toBe('bigint');
    expect(columnType(SupplierAssignment, 'quotedPromisedDate')).toBe(
      'timestamptz',
    );
    expect(columnType(SupplierAssignment, 'customerConfirmedQuoteAt')).toBe(
      'timestamptz',
    );
    expect(columnType(SupplierAssignment, 'promisedDate')).toBe('timestamptz');
  });
});
