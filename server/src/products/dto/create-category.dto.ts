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
  MaxLength,
  Matches,
  IsNotEmpty,
  Min,
  Max,
  ValidateIf,
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

  @ApiPropertyOptional({ example: 'Print documents, handouts, and posters.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  mobileDescription?: string;

  @ApiPropertyOptional({
    example: 'Best for: Businesses, startups, and events',
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  audienceLabel?: string;

  @ApiPropertyOptional({ example: 'FileTextOutlined' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Parent category id for subgroup / variant nesting',
  })
  @IsOptional()
  @IsInt()
  @IsPositive()
  parentId?: number | null;

  @ApiPropertyOptional({
    example: 1,
    description: '1 = category, 2 = subgroup, 3 = variant/leaf',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3)
  catalogLevel?: number;

  @ApiPropertyOptional({
    default: true,
    description: 'Whether this node can be ordered (leaves only)',
  })
  @IsOptional()
  @IsBoolean()
  isOrderable?: boolean;

  @ApiPropertyOptional({ enum: FileProcessingType })
  @IsOptional()
  @IsEnum(FileProcessingType)
  fileProcessingType?: FileProcessingType;

  @ApiPropertyOptional({ enum: PricingModel })
  @IsOptional()
  @IsEnum(PricingModel)
  pricingModel?: PricingModel;

  @ApiPropertyOptional({ example: 2.0 })
  @ValidateIf((dto: CreateCategoryDto) => dto.isOrderable !== false)
  @IsNumber()
  @Min(0)
  baseRate?: number;

  @ApiPropertyOptional({ example: 'page' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  quantityUnit?: string;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @IsPositive()
  maxFileSizeMb?: number;

  @ApiPropertyOptional({
    example: '["pdf","png","jpg"]',
    description: 'JSON array string of allowed file extensions',
  })
  @IsOptional()
  @IsString()
  allowedExtensions?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
