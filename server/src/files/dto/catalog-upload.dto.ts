import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDefined,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const isCatalogArtwork = (purpose?: string): boolean =>
  purpose?.trim().toLowerCase().replace(/-/g, '_') === 'catalog_artwork';

export class CatalogUploadDto {
  @ApiPropertyOptional({
    example: 'catalog_artwork',
    description:
      'Use catalog_artwork with productSlug for product-aware uploads.',
  })
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional({ example: 'flyers' })
  @ValidateIf((dto: CatalogUploadDto) => isCatalogArtwork(dto.purpose))
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  productSlug?: string;
}
