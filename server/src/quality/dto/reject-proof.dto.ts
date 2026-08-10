import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Client rejects a proof and returns the order to `client_correction`
 * so they can revise artwork (or Ops can re-open QA).
 */
export class RejectProofDto {
  @ApiPropertyOptional({
    description: 'Why the proof is rejected',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
