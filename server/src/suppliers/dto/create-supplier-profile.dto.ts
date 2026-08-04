import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSupplierProfileDto {
  @ApiProperty({ description: 'User id of the supplier account' })
  @IsInt()
  @Min(1)
  userId: number;

  @ApiProperty({ example: 'Davao Print Co', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  businessName: string;

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
