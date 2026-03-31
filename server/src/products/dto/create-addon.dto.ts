// server/src/products/dto/create-addon.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsInt,
  IsPositive,
  IsOptional,
  IsBoolean,
  MaxLength,
  IsIn,
  IsNotEmpty,
} from 'class-validator';

export class CreateAddonDto {
  @ApiPropertyOptional({ description: 'null means applies to all categories' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  categoryId?: number;

  @ApiProperty({ example: 'Lamination' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 20.0 })
  @IsNumber()
  @IsPositive()
  price: number;

  @ApiProperty({ enum: ['flat', 'per_unit'], example: 'per_unit' })
  @IsNotEmpty()
  @IsString()
  @IsIn(['flat', 'per_unit'])
  priceType: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
