import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'paper', enum: ['paper', '3d'] })
  @IsString()
  category: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 150.00 })
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
}
