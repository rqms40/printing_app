import {
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsIn,
  MinLength,
} from 'class-validator';
import type { PaperSpecsShape, ThreeDSpecsShape } from '../entities/daily-grid-card.entity';

export class CreateDailyGridCardDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsIn(['paper', '3d'])
  category: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  paperSpecs?: PaperSpecsShape;

  @IsOptional()
  @IsObject()
  threeDSpecs?: ThreeDSpecsShape;
}
