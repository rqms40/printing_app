import { IsInt, IsOptional, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStorageSettingsDto {
  @ApiPropertyOptional({ nullable: true, example: 45 })
  @IsOptional()
  @IsInt()
  @Min(1)
  fileRetentionDays: number | null;
}
