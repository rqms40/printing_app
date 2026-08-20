import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewMatchDto {
  @ApiProperty({ example: 'paper' })
  @IsString()
  @MaxLength(80)
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  destinationId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;
}
