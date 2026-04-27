import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PaperSpecsDto {
  @IsString() paperSize: string;
  @IsString() colorMode: string;
  @IsString() mediaType: string;
  @IsString() printSides: string;
  @IsString() @IsOptional() binding?: string;
  @IsOptional()
  @IsIn(['fitToPage', 'actualSize'])
  printMode?: 'fitToPage' | 'actualSize';
}

export class ThreeDSpecsDto {
  @IsString() fileFormat: string;
  @IsString() material: string;
  @IsString() color: string;
  @IsNumber() infillPercentage: number;
  @IsNumber() layerHeight: number;
  @IsBoolean() supports: boolean;
  @IsString() @IsOptional() notes?: string;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'paper', enum: ['paper', '3d'] })
  @IsString()
  category: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  totalPrice: number;

  @ApiProperty({ example: 0 })
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
  @IsString()
  fileName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
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
