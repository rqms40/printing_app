import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsPositive, Max, Min } from 'class-validator';

/**
 * Supplier accepts an assigned job with committed commercial terms.
 * Money: PHP minor units (centavos).
 */
export class AcceptSupplierJobDto {
  @ApiProperty({
    description: 'Final committed goods price in PHP minor units (centavos)',
    example: 150000,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  finalPriceMinor: number;

  @ApiProperty({
    description: 'Promised completion / ready-for-pickup date (ISO-8601)',
    example: '2026-08-12T08:00:00.000Z',
  })
  @IsDateString()
  promisedDate: string;
}
