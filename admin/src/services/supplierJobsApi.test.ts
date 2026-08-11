import { describe, expect, it } from 'vitest';
import { buildSupplierQuotePayload, canOperateProduction, formatMinorAsCurrency } from './supplierJobsApi';

describe('supplier quote contract', () => {
  it('formats bigint minor strings without Number coercion', () => {
    expect(formatMinorAsCurrency('900719925474099312345')).toBe('₱9,007,199,254,740,993,123.45');
    expect(formatMinorAsCurrency(null)).toBe('—');
  });

  it('requires both quote terms and creates the exact API payload', () => {
    expect(() => buildSupplierQuotePayload(null, null)).toThrow('Final price');
    expect(() => buildSupplierQuotePayload(100, null)).toThrow('Promised date');
    expect(buildSupplierQuotePayload(123.45, '2026-08-12T10:00:00.000Z')).toEqual({
      finalPriceMinor: 12345,
      promisedDate: '2026-08-12T10:00:00.000Z',
    });
  });

  it('keeps production payment-gated even if a stale action is projected', () => {
    expect(canOperateProduction(['production-status'], 'none')).toBe(false);
    expect(canOperateProduction(['production-status'], 'authorized')).toBe(true);
    expect(canOperateProduction([], 'authorized')).toBe(false);
  });
});
