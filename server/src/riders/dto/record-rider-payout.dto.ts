import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

/** Ops/super attaches a payout receipt for one completed rider delivery. */
export class RecordRiderPayoutDto {
  @ApiProperty({ example: 88 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  assignmentId: number;

  @ApiProperty({
    description: 'File metadata id of the ops payout receipt (purpose payout_receipt)',
    example: 91,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  receiptFileId: number;
}
