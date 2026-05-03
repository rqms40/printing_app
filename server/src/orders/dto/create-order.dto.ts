import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  IsEnum,
  Min,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  IsInt,
  IsPositive,
  Matches,
  MaxLength,
  IsObject,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PrintMode } from '../print-mode.enum';
import { DeliverySpeedTier } from '../enums/delivery-speed-tier.enum';

export class PaperSpecsDto {
  @IsString() paperSize: string;
  @IsString() colorMode: string;
  @IsString() mediaType: string;
  @IsString() printSides: string;
  @IsString() @IsOptional() binding?: string;
  @IsOptional()
  @IsIn(Object.values(PrintMode))
  printMode?: PrintMode;
}

export class ThreeDSpecsDto {
  @IsString() fileFormat: string;
  @IsString() material: string;
  @IsString() color: string;
  @Type(() => Number)
  @IsNumber()
  infillPercentage: number;

  @Type(() => Number)
  @IsNumber()
  layerHeight: number;

  @IsBoolean() supports: boolean;
  @IsString() @IsOptional() notes?: string;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'paper', enum: ['paper', '3d'] })
  @IsString()
  category: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 150.0 })
  @Type(() => Number)
  @IsNumber()
  totalPrice: number;

  @ApiProperty({ example: 0 })
  @Type(() => Number)
  @IsNumber()
  deliveryFee: number;

  @ApiProperty({ example: 'gcash', enum: ['gcash', 'maya', 'cod'] })
  @IsString()
  paymentMethod: string;

  @ApiProperty({ example: 'delivery', enum: ['pickup', 'delivery'] })
  @IsString()
  deliveryOption: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryAddressId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fileMetadataId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PaperSpecsDto)
  paperSpecs?: PaperSpecsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ThreeDSpecsDto)
  threeDSpecs?: ThreeDSpecsDto;

  @ApiPropertyOptional({ example: { paper_size: 'a4' } })
  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  addonIds?: number[];
}

export class TemporaryDeliveryAddressDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsString()
  @MaxLength(500)
  fullAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  barangay?: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  zipCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  landmark?: string;

  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude: number;
}

export class CreateBatchDestinationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  addressId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => TemporaryDeliveryAddressDto)
  address?: TemporaryDeliveryAddressDto;
}

export class CreateBatchOrderItemDto {
  @ApiProperty({ example: 'paper', enum: ['paper', '3d'] })
  @IsString()
  category: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 150.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialInstructions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fileMetadataId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => PaperSpecsDto)
  paperSpecs?: PaperSpecsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ThreeDSpecsDto)
  threeDSpecs?: ThreeDSpecsDto;

  @ApiPropertyOptional({ example: { paper_size: 'a4' } })
  @IsOptional()
  @IsObject()
  specs?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  addonIds?: number[];

  @IsOptional()
  @IsInt()
  @Min(0)
  destinationIndex?: number;
}

export class CreateBatchOrderDto {
  @ApiProperty({ type: [CreateBatchOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBatchOrderItemDto)
  items: CreateBatchOrderItemDto[];

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryFee?: number;

  @ApiProperty({ example: 'gcash', enum: ['gcash', 'maya', 'cod'] })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional()
  @IsString()
  paymentStatus?: string;

  @ApiProperty({ example: 'delivery', enum: ['pickup', 'delivery'] })
  @IsString()
  deliveryOption: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  deliveryAddressId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  slotTemplateId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  slotDate?: string;

  @IsOptional()
  @IsEnum(DeliverySpeedTier)
  speedTier?: DeliverySpeedTier;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBatchDestinationDto)
  destinations?: CreateBatchDestinationDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TemporaryDeliveryAddressDto)
  temporaryAddress?: TemporaryDeliveryAddressDto;
}
