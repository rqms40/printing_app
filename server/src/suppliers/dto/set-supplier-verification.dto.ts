import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupplierVerificationStatus } from '../entities/supplier-verification.entity';

export class SetSupplierVerificationDto {
  @ApiProperty({
    enum: SupplierVerificationStatus,
    example: SupplierVerificationStatus.VERIFIED,
  })
  @IsEnum(SupplierVerificationStatus)
  status: SupplierVerificationStatus;

  @ApiPropertyOptional({
    description: 'Opaque payout details reference (no raw secrets)',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  payoutDetailsRef?: string | null;

  @ApiPropertyOptional({ description: 'Reviewer notes' })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
