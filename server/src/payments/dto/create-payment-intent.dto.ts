import { IsNumber, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentIntentDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  orderId: number;

  @ApiProperty({ example: 'gcash', enum: ['gcash', 'maya', 'cod'] })
  @IsString()
  paymentMethod: string;

  @ApiProperty({ example: 250.0 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;
}
