import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateTamSurveyDto {
  @IsObject()
  survey_data: any;

  @IsOptional()
  @IsString()
  open_forum_feedback?: string;
}
