import { IsEnum } from 'class-validator';
import { HomeFeedMode } from '../entities/home-feed-settings.entity';

export class UpdateHomeFeedSettingsDto {
  @IsEnum(HomeFeedMode)
  mode: HomeFeedMode;
}
