import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateRiderProfileDto {
  @ApiPropertyOptional({ example: 'motorcycle', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicleType?: string;

  @ApiPropertyOptional({ example: 'ABC-1234', maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  plateNumber?: string;

  @ApiPropertyOptional({ example: 'N01-23-456789', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  licenseNumber?: string;

  /** Instapay / wallet QR used by ops to pay this rider. */
  @ApiPropertyOptional({ example: 88 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  payoutQrFileId?: number | null;
}
