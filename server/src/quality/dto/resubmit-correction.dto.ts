import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * Client resubmits revised artwork after Ops `needs_correction`.
 * File must already be uploaded via POST /files/upload and owned by the client.
 */
export class ResubmitCorrectionDto {
  @ApiProperty({
    description: 'Uploaded file_metadata id for the revised artwork',
    example: 42,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileMetadataId: number;

  @ApiPropertyOptional({
    description: 'Optional client note for Ops QA',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
