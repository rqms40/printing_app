import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export const MOCKUP_PRODUCT_TYPES = [
  'flyer',
  'tarpaulin',
  'signage',
  't-shirt',
  'other',
] as const;

export type MockupProductType = (typeof MOCKUP_PRODUCT_TYPES)[number];

export class CreateMockupDto {
  @ApiProperty({ description: 'Artwork file metadata id' })
  @IsInt()
  @IsPositive()
  artworkFileId: number;

  @ApiProperty({
    enum: MOCKUP_PRODUCT_TYPES,
    description: 'Product family for static template composite',
  })
  @IsString()
  @IsIn(MOCKUP_PRODUCT_TYPES)
  productType: MockupProductType;

  @ApiPropertyOptional({ description: 'Optional order id for scoped preview' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;

  @ApiPropertyOptional({
    description: 'Category slug when productType=other (maps best-effort)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoryHint?: string;
}
