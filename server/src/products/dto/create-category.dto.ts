// server/src/products/dto/create-category.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsNumber, IsInt, IsPositive,
  IsOptional, IsBoolean, MaxLength, Matches, IsNotEmpty,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Paper Printing' })
  @IsNotEmpty() @IsString() @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'paper', description: 'Lowercase alphanumeric + hyphens' })
  @IsNotEmpty() @IsString() @MaxLength(50) @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'FileTextOutlined' })
  @IsOptional() @IsString() @MaxLength(50)
  icon?: string;

  @ApiProperty({ example: 2.0 })
  @IsNumber() @IsPositive()
  baseRate: number;

  @ApiProperty({ example: 50 })
  @IsInt() @IsPositive()
  maxFileSizeMb: number;

  @ApiProperty({ example: '["pdf","png","jpg"]', description: 'JSON array string of allowed file extensions' })
  @IsNotEmpty() @IsString()
  allowedExtensions: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsInt()
  sortOrder?: number;
}
