import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional, MaxLength, IsLatitude, IsLongitude } from 'class-validator';

export class CreateAddressDto {
  @ApiProperty({ example: 'Home', maxLength: 50 })
  @IsString()
  @MaxLength(50)
  label: string;

  @ApiProperty({ example: '123 Rizal St, Brgy. San Antonio, Makati City' })
  @IsString()
  fullAddress: string;

  @ApiPropertyOptional({ example: 'San Antonio', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barangay?: string;

  @ApiProperty({ example: 'Makati City', maxLength: 100 })
  @IsString()
  @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ example: 'Metro Manila', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional({ example: '1203', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  zipCode?: string;

  @ApiPropertyOptional({ example: 'Near Jollibee on the corner' })
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiProperty({ example: 14.5547 })
  @IsNumber()
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 121.0244 })
  @IsNumber()
  @IsLongitude()
  longitude: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
