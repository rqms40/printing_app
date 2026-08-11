import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSupplierCapabilityDto {
  @ApiProperty({ example: 'flyers', maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  productFamily: string;

  @ApiPropertyOptional({
    example: ['glossy', 'matte'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  materials?: string[];

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxCapacity?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeDays?: number;
}
