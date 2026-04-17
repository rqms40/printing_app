import {
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
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

  @ApiProperty({ enum: ProfileCategory })
  @IsEnum(ProfileCategory)
  profileCategory: ProfileCategory;

  @ApiProperty({ enum: ProfileField })
  @IsEnum(ProfileField)
  profileField: ProfileField;

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
