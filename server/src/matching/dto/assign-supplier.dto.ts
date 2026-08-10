import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AssignSupplierDto {
  @ApiProperty({ description: 'Supplier profile id to assign' })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  supplierId: number;

  @ApiPropertyOptional({
    description: 'Optional ops note stored on the assignment decision reason',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
