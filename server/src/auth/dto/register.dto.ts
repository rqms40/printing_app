import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AgeRange,
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from '../../users/profile.constants';

export class RegisterDto {
  @ApiProperty({ example: 'user@gridprint.ph' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'securePassword123' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Maria Santos' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  fullName: string;

  @ApiPropertyOptional({ example: 'Mia' })
  @IsOptional()
  @IsString()
  @Matches(/\S/)
  nickname?: string;

  @ApiProperty({ enum: ProfileCategory })
  @IsEnum(ProfileCategory)
  profileCategory: ProfileCategory;

  @ApiProperty({ enum: ProfileField })
  @IsEnum(ProfileField)
  profileField: ProfileField;

  @ApiPropertyOptional({ enum: AgeRange })
  @IsOptional()
  @IsEnum(AgeRange)
  ageRange?: AgeRange;

  @ApiPropertyOptional({ example: '+639171234567' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'female' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: '2001-02-03' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiProperty({ required: false, example: 'BS Architecture' })
  @IsOptional()
  @IsString()
  course?: string;

  @ApiProperty({ required: false, example: 'Mapua University' })
  @IsOptional()
  @IsString()
  organization?: string;

  @ApiProperty({
    required: false,
    enum: PrintingPreference,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PrintingPreference, { each: true })
  printingPreferences?: PrintingPreference[];
}
