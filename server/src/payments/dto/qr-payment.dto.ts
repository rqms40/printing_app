import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectQrPaymentDto {
  @ApiPropertyOptional({ example: 'Receipt amount does not match order total' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
