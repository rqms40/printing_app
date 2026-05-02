import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { DeliverySpeedTier } from '../enums/delivery-speed-tier.enum';

export class QuoteOrderItemDto {
  @ApiProperty({ example: 'paper' })
  @IsString()
  categorySlug: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: { paper_size: 'a4' } })
  @IsObject()
  specs: Record<string, unknown>;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  addonIds?: number[];
}

export class QuoteOrderDto {
  @ApiProperty({ type: [QuoteOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteOrderItemDto)
  items: QuoteOrderItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deliveryOption?: string;

  @ApiPropertyOptional({ enum: DeliverySpeedTier })
  @IsOptional()
  @IsString()
  speedTier?: DeliverySpeedTier;
}
