import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateDriverProfileDto {
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
}
