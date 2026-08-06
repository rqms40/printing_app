import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  Matches,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AgeRange,
  ClientAccountType,
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from '../../users/profile.constants';
import { SUPPLIER_SERVICE_FOCUS_KEYS } from '../../suppliers/dto/update-supplier-profile.dto';

export class RegisterDto {
  @ApiProperty({ example: 'user@gridgo.ph' })
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

  /**
   * Required for student/professional. For supplier lane, server defaults to
   * print_shop when omitted.
   */
  @ApiPropertyOptional({ enum: ProfileField })
  @ValidateIf((o: RegisterDto) => o.profileCategory !== ProfileCategory.SUPPLIER)
  @IsEnum(ProfileField)
  profileField?: ProfileField;

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

  /**
   * Optional marketplace client metadata (business | organization | teacher).
   * Not required so existing mobile register stays compatible.
   */
  @ApiPropertyOptional({ enum: ClientAccountType })
  @IsOptional()
  @IsEnum(ClientAccountType)
  clientAccountType?: ClientAccountType;

  @ApiProperty({
    required: false,
    enum: PrintingPreference,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PrintingPreference, { each: true })
  printingPreferences?: PrintingPreference[];

  /**
   * Supplier lane only: ordered service focuses (1st = index 0).
   * Required when profileCategory is supplier.
   */
  @ApiPropertyOptional({
    example: ['signages', 'document_printing', 'apparel'],
    type: [String],
  })
  @ValidateIf((o: RegisterDto) => o.profileCategory === ProfileCategory.SUPPLIER)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SUPPLIER_SERVICE_FOCUS_KEYS.length)
  @IsString({ each: true })
  @IsIn([...SUPPLIER_SERVICE_FOCUS_KEYS], { each: true })
  serviceFocusRanks?: string[];
}
