import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateManualStatusDto {
  @ValidateIf((o: UpdateManualStatusDto) => o.note !== null)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note: string | null;

  @ValidateIf((o: UpdateManualStatusDto) => o.estimatedCompletionAt !== null)
  @IsOptional()
  @IsDateString()
  estimatedCompletionAt: string | null;
}
