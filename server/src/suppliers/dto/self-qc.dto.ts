import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Supplier self-QC evidence before ready-for-dispatch.
 * Prefer upload via POST /files/upload then pass evidenceFileIds;
 * multipart file on this endpoint is also accepted.
 */
export class SelfQcDto {
  @ApiPropertyOptional({
    description:
      'Previously uploaded file_metadata ids (images/docs) as evidence',
    type: [Number],
    example: [101, 102],
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    if (Array.isArray(value)) {
      return value.map((v) => Number(v));
    }
    // multipart form may send a single id or JSON string
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.startsWith('[')) {
        try {
          const parsed: unknown = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map((v) => Number(v));
        } catch {
          /* fall through */
        }
      }
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => Number(s));
    }
    return [Number(value)];
  })
  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  evidenceFileIds?: number[];

  @ApiPropertyOptional({
    description: 'Optional self-QC checklist results',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return value;
      }
    }
    return value as Record<string, unknown>;
  })
  @IsObject()
  checklist?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Optional notes about self-QC outcome',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
