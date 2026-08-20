import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

/** Client pays / confirms the supplier's final quoted price. */
export class ConfirmSupplierQuoteDto {
  @ApiPropertyOptional({
    description:
      'Required when paymentMethod is qr_ph_instapay — uploaded payment receipt file id',
    example: 88,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  qrReceiptFileId?: number;
}
