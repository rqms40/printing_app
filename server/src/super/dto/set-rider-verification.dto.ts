import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RiderVerificationStatus } from '../../riders/entities/rider-profile.entity';

export class SetRiderVerificationDto {
  @ApiProperty({ enum: RiderVerificationStatus })
  @IsEnum(RiderVerificationStatus)
  status: RiderVerificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string | null;
}
