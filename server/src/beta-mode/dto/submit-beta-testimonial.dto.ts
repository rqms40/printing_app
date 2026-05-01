import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class SubmitBetaTestimonialDto {
  @IsInt()
  fileId: number;

  @IsOptional()
  @IsBoolean()
  sharedOnSocial?: boolean;
}
