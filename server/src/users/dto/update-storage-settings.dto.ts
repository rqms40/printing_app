import { IsInt, Max, Min, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStorageSettingsDto {
  @ApiPropertyOptional({ nullable: true, example: 45 })
  @ValidateIf((o: UpdateStorageSettingsDto) => o.fileRetentionDays !== null)
  @IsInt()
  @Min(1)
  @Max(999)
  fileRetentionDays: number | null;
}
