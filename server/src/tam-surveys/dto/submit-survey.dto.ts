import { Allow, IsObject } from 'class-validator';

export class SubmitTamSurveyDto {
  @IsObject()
  survey_data: Record<string, number>;

  @Allow()
  open_forum_feedback: Record<string, string> | string;
}

export class SubmitSurveyRequirementDto {
  @IsObject()
  surveyData: Record<string, number>;

  @IsObject()
  openForumFeedback: Record<string, string>;
}
