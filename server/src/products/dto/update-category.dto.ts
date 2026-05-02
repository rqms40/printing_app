// server/src/products/dto/update-category.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsInt,
  IsPositive,
  IsOptional,
  IsBoolean,
  IsEnum,
  MaxLength,
  Matches,
} from 'class-validator';

import {
  FileProcessingType,
  PricingModel,
} from '../enums/catalog.enums';

export class UpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/)
  slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) mobileDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @ApiPropertyOptional({ enum: FileProcessingType }) @IsOptional() @IsEnum(FileProcessingType) fileProcessingType?: FileProcessingType;
  @ApiPropertyOptional({ enum: PricingModel }) @IsOptional() @IsEnum(PricingModel) pricingModel?: PricingModel;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  baseRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) quantityUnit?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxFileSizeMb?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() allowedExtensions?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
