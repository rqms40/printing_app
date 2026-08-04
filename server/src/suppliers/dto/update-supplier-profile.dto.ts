import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateSupplierProfileDto {
  @ApiPropertyOptional({ example: 'Davao Print Co', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @ApiPropertyOptional({
    example: ['Davao City', 'Toril'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceZones?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
