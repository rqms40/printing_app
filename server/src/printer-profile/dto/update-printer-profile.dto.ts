import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class UpdatePrinterProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  buildVolumeWidthMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  buildVolumeDepthMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  buildVolumeHeightMm?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  maxFileSizeMb?: number;
}
