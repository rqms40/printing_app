import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  DeliveryStatus,
  ProofOfDeliveryType,
} from '../entities/delivery-assignment.entity';

export class ProofOfDeliveryDto {
  @ApiProperty({
    enum: ProofOfDeliveryType,
    example: ProofOfDeliveryType.PHOTO,
  })
  @IsEnum(ProofOfDeliveryType)
  type: ProofOfDeliveryType;

  @ApiPropertyOptional({ example: 55 })
  @IsOptional()
  @IsInt()
  fileId?: number;

  @ApiPropertyOptional({ example: 'uploads/pod/2026/05/02/file.jpg' })
  @IsOptional()
  @IsString()
  objectKey?: string;

  @ApiPropertyOptional({ example: 'svg:path-data' })
  @IsOptional()
  @IsString()
  signatureData?: string;
}

export class UpdateDeliveryStatusDto {
  @ApiProperty({ enum: DeliveryStatus, example: DeliveryStatus.PICKED_UP })
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @ApiPropertyOptional({ example: 'Customer unreachable' })
  @IsOptional()
  @IsString()
  declineReason?: string;

  @ApiPropertyOptional({ type: ProofOfDeliveryDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ProofOfDeliveryDto)
  proof?: ProofOfDeliveryDto;
}
