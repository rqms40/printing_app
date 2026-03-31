// server/src/products/dto/update-spec-option.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsInt,
  IsPositive,
  Min,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class UpdateSpecOptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  optionGroup?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  value?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  multiplier?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) fixedFee?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitCost?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) estimatedGrams?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
