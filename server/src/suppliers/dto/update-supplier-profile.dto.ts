import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

/** Allowed service-focus catalog keys (onboarding + profile edit). */
export const SUPPLIER_SERVICE_FOCUS_KEYS = [
  'signages',
  'tarpaulins',
  'document_printing',
  'apparel',
  'stickers_labels',
  'large_format',
  '3d_printing',
  'invitations_cards',
] as const;

export type SupplierServiceFocusKey =
  (typeof SUPPLIER_SERVICE_FOCUS_KEYS)[number];

export class UpdateSupplierProfileDto {
  @ApiPropertyOptional({ example: 'Davao Print Co', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @ApiPropertyOptional({ example: 'Large-format and flyers for Davao SMEs.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string | null;

  @ApiPropertyOptional({ example: 'hello@printco.ph' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== '')
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string | null;

  @ApiPropertyOptional({ example: '123 Quimpo Blvd, Davao City' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ example: 7.0505, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @IsLatitude()
  latitude?: number | null;

  @ApiPropertyOptional({ example: 125.5889, nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @IsLongitude()
  longitude?: number | null;

  @ApiPropertyOptional({
    example: ['Davao City', 'Toril'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serviceZones?: string[];

  /** Replace entire attributes map (equipment, finishes, etc.). */
  @ApiPropertyOptional({
    example: { equipment: 'HP Latex', finishes: 'lamination' },
  })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  /** Profile logo / picture file metadata id (owned by supplier). */
  @ApiPropertyOptional({ example: 42 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  logoFileId?: number | null;

  /**
   * Ordered service focuses (1st = index 0). Must be unique catalog keys.
   * Example: ['signages', 'document_printing', 'apparel']
   */
  @ApiPropertyOptional({
    example: ['signages', 'document_printing', 'apparel'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SUPPLIER_SERVICE_FOCUS_KEYS.length)
  @IsString({ each: true })
  @IsIn([...SUPPLIER_SERVICE_FOCUS_KEYS], { each: true })
  serviceFocusRanks?: string[];

  /** Super-admin only; suppliers cannot toggle own isActive via self-edit. */
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
