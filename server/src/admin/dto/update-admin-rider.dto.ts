import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateAdminRiderDto {
  @ApiPropertyOptional({ example: 'Juan Dela Cruz', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: 'juan@example.com', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ example: '+639123456789', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phoneNumber?: string;

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
