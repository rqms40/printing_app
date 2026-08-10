import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Production milestone labels (PRD §7.8).
 * Coarse order status only has `payment_authorized` → `production`;
 * finer milestones are audited while production is active.
 */
export enum ProductionMilestone {
  MATERIALS_SETUP = 'materials_setup',
  IN_PRODUCTION = 'in_production',
  PRODUCTION_COMPLETE = 'production_complete',
}

/**
 * Supplier production milestone / status update.
 * Entering production requires `payment_authorized` + authorized payment flag.
 */
export class ProductionStatusDto {
  @ApiPropertyOptional({
    enum: ProductionMilestone,
    description:
      'Production milestone. materials_setup / in_production enter production from payment_authorized when needed.',
  })
  @IsOptional()
  @IsEnum(ProductionMilestone)
  milestone?: ProductionMilestone;

  @ApiPropertyOptional({
    description:
      "Alias: set to 'production' to start production from payment_authorized",
    example: 'production',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @ApiPropertyOptional({
    description: 'Optional supplier note for the milestone',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
