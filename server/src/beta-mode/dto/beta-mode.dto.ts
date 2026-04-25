import { IsBoolean } from 'class-validator';

export class UpdateBetaModeSettingsDto {
  @IsBoolean()
  isEnabled: boolean;
}
