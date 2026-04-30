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
}

export class CreateBatchDestinationDto {
  @IsInt()
  @IsPositive()
  addressId: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
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

  /** @deprecated Use speedTier='priority' instead. Removed in Phase 4. */
  @IsOptional()
  @IsBoolean()
  priority?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBatchDestinationDto)
  destinations?: CreateBatchDestinationDto[];
}
