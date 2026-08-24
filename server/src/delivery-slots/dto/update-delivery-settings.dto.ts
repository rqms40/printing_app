import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateDeliverySettingsDto {
  @IsOptional()
  @IsNumber()
  serviceCenterLat?: number;

  @IsOptional()
  @IsNumber()
  serviceCenterLng?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  serviceRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priorityFeeAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deliveryFeePerKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraDestinationSurcharge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  serviceFeePercent?: number;
}
