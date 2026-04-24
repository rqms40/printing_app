import {
  IsString,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsIn,
  ValidateIf,
} from 'class-validator';
import type { PaperSpecsShape, ThreeDSpecsShape } from '../entities/daily-grid-card.entity';

export class UpdateDailyGridCardDto {
  @IsOptional()
  @IsString()
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

  @IsOptional()
  @ValidateIf((o: UpdateDailyGridCardDto) => o.paperSpecs !== null)
  @IsObject()
  paperSpecs?: PaperSpecsShape | null;

  @IsOptional()
  @ValidateIf((o: UpdateDailyGridCardDto) => o.threeDSpecs !== null)
  @IsObject()
  threeDSpecs?: ThreeDSpecsShape | null;
}
