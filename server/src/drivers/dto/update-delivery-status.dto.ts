import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DeliveryStatus } from '../entities/delivery-assignment.entity';

export class UpdateDeliveryStatusDto {
  @ApiProperty({ enum: DeliveryStatus, example: DeliveryStatus.PICKED_UP })
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;

  @ApiPropertyOptional({ example: 'Customer unreachable' })
  @IsOptional()
  @IsString()
  declineReason?: string;
}
