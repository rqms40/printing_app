import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsPositive } from 'class-validator';

export enum QuotePaymentMethod {
  PILOT_CREDIT = 'pilot_credit',
  COD = 'cod',
}

export class AcceptQuoteDto {
  @ApiProperty({ example: 41 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  supplierAssignmentId: number;

  @ApiProperty({ enum: QuotePaymentMethod })
  @IsEnum(QuotePaymentMethod)
  paymentMethod: QuotePaymentMethod;
}
