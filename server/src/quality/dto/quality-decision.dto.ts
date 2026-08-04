import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QualityReviewRiskLevel } from '../entities/quality-review.entity';

/**
 * API decision values (brief 4.1).
 * `proof_required` is the preferred API label; `proof_approval` is accepted
 * as an alias matching the QualityReview entity / order status enum.
 */
export enum QualityDecisionInput {
  NEEDS_CORRECTION = 'needs_correction',
  PROOF_REQUIRED = 'proof_required',
  PROOF_APPROVAL = 'proof_approval',
  APPROVED_FOR_MATCHING = 'approved_for_matching',
  BLOCKED = 'blocked',
}

export class QualityDecisionDto {
  @ApiProperty({ enum: QualityDecisionInput })
  @IsEnum(QualityDecisionInput)
  decision: QualityDecisionInput;

  @ApiProperty({
    description: 'Structured checklist pass/fail results',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  checklist: Record<string, unknown>;

  @ApiProperty({ enum: QualityReviewRiskLevel })
  @IsEnum(QualityReviewRiskLevel)
  riskLevel: QualityReviewRiskLevel;

  @ApiPropertyOptional({
    description: 'Required when decision is needs_correction',
  })
  @ValidateIf(
    (o: QualityDecisionDto) =>
      o.decision === QualityDecisionInput.NEEDS_CORRECTION,
  )
  @IsString()
  @MaxLength(4000)
  correctionRequest?: string;

  @ApiPropertyOptional({
    description:
      'Forces proof-required flag. Always true for proof_required/proof_approval decisions.',
  })
  @IsOptional()
  @IsBoolean()
  proofRequired?: boolean;

  @ApiPropertyOptional({
    description: 'Optional evidence refs (file ids, notes) — not binaries',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  evidence?: Record<string, unknown>;
}
