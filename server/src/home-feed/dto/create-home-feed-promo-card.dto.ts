import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateHomeFeedPromoCardDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'title must contain non-whitespace text' })
  @MaxLength(80)
  title: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'body must contain non-whitespace text' })
  @MaxLength(220)
  body?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'ctaLabel must contain non-whitespace text' })
  @MaxLength(32)
  ctaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^(\/|https:\/\/)/, {
    message: 'ctaTarget must be an in-app route or HTTPS URL',
  })
  ctaTarget?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  imageUrl?: string | null;

  @ValidateIf(
    (_dto: CreateHomeFeedPromoCardDto, value: unknown) => value !== undefined,
  )
  @IsBoolean()
  isActive?: boolean;
}
