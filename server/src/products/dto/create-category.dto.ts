// server/src/products/dto/create-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsInt,
  IsPositive,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  Min,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';

import { FileProcessingType, PricingModel } from '../enums/catalog.enums';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Paper Printing' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'paper',
    description: 'Lowercase alphanumeric + hyphens',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'marketing-promo' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'groupSlug must be lowercase alphanumeric with hyphens',
  })
  groupSlug?: string;

  @ApiPropertyOptional({ example: 'Marketing & Promotional Collateral' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  groupName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupDescription?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  groupSortOrder?: number;

  @ApiPropertyOptional({ example: 'Print documents, handouts, and posters.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  mobileDescription?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  examples?: string[];

  @ApiPropertyOptional({ example: 'FileTextOutlined' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ enum: FileProcessingType })
  @IsOptional()
  @IsEnum(FileProcessingType)
  fileProcessingType?: FileProcessingType;

  @ApiPropertyOptional({ enum: PricingModel })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiProperty({ example: 2.0 })
  @IsNumber()
  @Min(0)
  baseRate: number;

  @ApiPropertyOptional({ example: 'page' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  quantityUnit?: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @IsPositive()
  maxFileSizeMb: number;

  @ApiProperty({
    example: '["pdf","png","jpg"]',
    description: 'JSON array string of allowed file extensions',
  })
  @IsNotEmpty()
  @IsString()
  allowedExtensions: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
