import { IsArray, IsString } from 'class-validator';

export class UpdateTutorialKeysDto {
  @IsArray()
  @IsString({ each: true })
  keys: string[];
}
