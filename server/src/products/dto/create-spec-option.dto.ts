// server/src/products/dto/create-spec-option.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsInt, IsPositive, Min,
  IsOptional, IsBoolean, MaxLength,
} from 'class-validator';

export class CreateSpecOptionDto {
  @ApiProperty({ example: 1 })
  @IsInt() @IsPositive()
  categoryId: number;

  @ApiProperty({ example: 'paper_size', description: 'Group name: paper_size, color_mode, material, etc.' })
  @IsString() @MaxLength(50)
  optionGroup: string;

  @ApiProperty({ example: 'A4' })
  @IsString() @MaxLength(100)
  label: string;

  @ApiProperty({ example: 'a4' })
  @IsString() @MaxLength(50)
  value: string;

  @ApiPropertyOptional({ example: 1.0, default: 1.0 })
  @IsOptional() @IsNumber() @IsPositive()
  multiplier?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  fixedFee?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  unitCost?: number;

  @ApiPropertyOptional({ example: 40, description: 'Estimated grams for 3D infill options' })
  @IsOptional() @IsInt() @Min(0)
  estimatedGrams?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt()
  sortOrder?: number;
}
