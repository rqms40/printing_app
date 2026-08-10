import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGeoZoneDto {
  @ApiProperty({ example: 'Davao City Core' })
  @IsString()
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'davao_city_core' })
  @IsString()
  @MaxLength(40)
  code: string;

  @ApiProperty({
    description: 'GeoJSON Polygon with [lng, lat] rings',
    example: {
      type: 'Polygon',
      coordinates: [
        [
          [125.45, 7.0],
          [125.75, 7.0],
          [125.75, 7.2],
          [125.45, 7.2],
          [125.45, 7.0],
        ],
      ],
    },
  })
  @IsObject()
  polygon: {
    type: 'Polygon';
    coordinates: number[][][];
  };

  @ApiPropertyOptional({ example: 2500, description: 'PHP centavos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  baseDeliveryFeeMinor?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateGeoZoneDto extends PartialType(CreateGeoZoneDto) {}

export class UpdateCommerceSettingsDto {
  @ApiPropertyOptional({
    example: 1500,
    description: 'Commission basis points (1500 = 15%)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultCommissionBps?: number;

  @ApiPropertyOptional({ example: 2500, description: 'PHP centavos' })
  @IsOptional()
  @IsInt()
  @Min(0)
  defaultDeliveryFeeMinor?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  rejectOutsideZones?: boolean;
}
