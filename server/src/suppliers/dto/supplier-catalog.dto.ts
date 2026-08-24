import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CatalogAddonDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ enum: ['flat', 'per_unit'] })
  @IsOptional()
  @IsIn(['flat', 'per_unit'])
  priceType?: 'flat' | 'per_unit';
}

export class UpsertSupplierCatalogOfferingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  title: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  categorySlugs: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  specOptions?: Record<string, string[]>;

  @ApiPropertyOptional({ type: [CatalogAddonDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CatalogAddonDto)
  addons?: CatalogAddonDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  baseRatePesos?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  pricingUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
