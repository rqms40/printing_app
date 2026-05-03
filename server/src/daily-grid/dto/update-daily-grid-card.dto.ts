import {
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { DailyGridSpecValues } from '../entities/daily-grid-card.entity';

export class UpdateDailyGridCardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @Matches(/^[a-z0-9][a-z0-9_-]*$/)
  category?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // null clears the field; @IsOptional skips validation for undefined
  @IsOptional()
  @ValidateIf((o: UpdateDailyGridCardDto) => o.specs !== null)
  @IsObject()
  specs?: DailyGridSpecValues | null;
}
