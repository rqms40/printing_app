import {
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  Matches,
  MinLength,
} from 'class-validator';
import type { DailyGridSpecValues } from '../entities/daily-grid-card.entity';

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

  @Matches(/^[a-z0-9][a-z0-9_-]*$/)
  category: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  specs?: DailyGridSpecValues | null;
}
