import { IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStorageSettingsDto {
  @ApiPropertyOptional({ nullable: true, example: 7 })
  @IsIn([null, 1, 7, 30], {
    message: 'fileRetentionDays must be null, 1, 7, or 30',
  })
  fileRetentionDays: number | null;
}
