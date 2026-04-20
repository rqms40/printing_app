import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  AgeRange,
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from '../profile.constants';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Maria Santos' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'Mia' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'female' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ enum: AgeRange })
  @IsOptional()
  @IsEnum(AgeRange)
  ageRange?: AgeRange;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ProfileCategory })
  @IsOptional()
  @IsEnum(ProfileCategory)
  profileCategory?: ProfileCategory;

  @ApiPropertyOptional({ enum: ProfileField })
  @IsOptional()
  @IsEnum(ProfileField)
  profileField?: ProfileField;

  @ApiPropertyOptional({ example: 'BS Architecture' })
  @IsOptional()
  @IsString()
  course?: string;

  @ApiPropertyOptional({ example: 'Mapua University' })
  @IsOptional()
  @IsString()
  organization?: string;

  @ApiPropertyOptional({ enum: PrintingPreference, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(PrintingPreference, { each: true })
  printingPreferences?: PrintingPreference[];
}
