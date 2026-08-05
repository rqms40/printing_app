import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

/** Ops resolution paths that drive payout impact. */
export const ISSUE_RESOLVE_PATHS = [
  'reprint',
  'refund',
  'adjustment',
  'release',
  'reject',
] as const;

export type IssueResolvePath = (typeof ISSUE_RESOLVE_PATHS)[number];

export class ResolveIssueDto {
  @ApiProperty({ enum: ISSUE_RESOLVE_PATHS })
  @IsString()
  @IsIn(ISSUE_RESOLVE_PATHS)
  path: IssueResolvePath;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNotes?: string;

  /** PHP minor units as digit string when path=refund. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^\d+$/)
  refundAmountMinor?: string;

  /** PHP minor units (signed digit string) when path=adjustment. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^-?\d+$/)
  adjustmentAmountMinor?: string;
}
