import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  CreateBatchDestinationDto,
  TemporaryDeliveryAddressDto,
} from './create-order.dto';

export class SubmitRfqItemDto {
  @ApiProperty({ example: 'flyers' })
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  categorySlug: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiProperty({ example: '2026-09-15' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  requiredDate: string;

  @ApiProperty({ example: 41 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  fileMetadataId: number;

  @ApiProperty({ example: { dimensions_or_standard_size: 'A5' } })
  @IsObject()
  specs: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  specialInstructions?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  destinationIndex?: number;
}

export class SubmitRfqDto {
  @ApiProperty({ type: [SubmitRfqItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitRfqItemDto)
  items: SubmitRfqItemDto[];

  @ApiProperty({ enum: ['pickup', 'delivery'] })
  @IsIn(['pickup', 'delivery'])
  deliveryOption: 'pickup' | 'delivery';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  deliveryAddressId?: number;

  @ApiPropertyOptional({ type: TemporaryDeliveryAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TemporaryDeliveryAddressDto)
  temporaryAddress?: TemporaryDeliveryAddressDto;

  @ApiPropertyOptional({ type: [CreateBatchDestinationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBatchDestinationDto)
  destinations?: CreateBatchDestinationDto[];
}
