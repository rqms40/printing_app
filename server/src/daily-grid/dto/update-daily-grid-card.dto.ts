import {
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsIn,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { PaperSpecsShape, ThreeDSpecsShape } from '../entities/daily-grid-card.entity';

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
  @IsIn(['paper', '3d'])
  category?: string;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // null clears the field; @IsOptional skips validation for undefined
  @IsOptional()
  @ValidateIf((o: UpdateDailyGridCardDto) => o.paperSpecs !== null)
  @IsObject()
  paperSpecs?: PaperSpecsShape | null;

  // null clears the field; @IsOptional skips validation for undefined
  @IsOptional()
  @ValidateIf((o: UpdateDailyGridCardDto) => o.threeDSpecs !== null)
  @IsObject()
  threeDSpecs?: ThreeDSpecsShape | null;
}
