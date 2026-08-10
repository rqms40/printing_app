import { getMetadataArgsStorage } from 'typeorm';
import { QualityReview } from './quality-review.entity';

function columnType(
  target: Function,
  propertyName: string,
): string | Function | undefined {
  return getMetadataArgsStorage().columns.find(
    (column) =>
      column.target === target && column.propertyName === propertyName,
  )?.options.type as string | Function | undefined;
}

describe('QualityReview entity metadata', () => {
  it('maps to quality_reviews table', () => {
    const table = getMetadataArgsStorage().tables.find(
      (t) => t.target === QualityReview,
    );
    expect(table?.name).toBe('quality_reviews');
  });

  it('declares Ops QA field contract columns', () => {
    expect(columnType(QualityReview, 'orderId')).toBe('int');
    expect(columnType(QualityReview, 'reviewerId')).toBe('int');
    expect(columnType(QualityReview, 'checklistResults')).toBe('jsonb');
    expect(columnType(QualityReview, 'decision')).toBe('enum');
    expect(columnType(QualityReview, 'riskLevel')).toBe('enum');
    expect(columnType(QualityReview, 'correctionRequest')).toBe('text');
    expect(columnType(QualityReview, 'proofRequired')).toBe('boolean');
    expect(columnType(QualityReview, 'evidence')).toBe('jsonb');
  });
});
