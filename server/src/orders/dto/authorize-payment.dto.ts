import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

/** Ops/super must attach a payout receipt before a 50% supplier installment. */
export class AuthorizePaymentDto {
  @ApiProperty({
    description:
      'File metadata id of the ops/super payout receipt (purpose payout_receipt)',
    example: 88,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  receiptFileId: number;
}
