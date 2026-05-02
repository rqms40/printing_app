import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import {
  InputType,
  PricingRole,
  ValueType,
} from '../enums/catalog.enums';

export class CreateSpecDefinitionDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  categoryId: number;

  @ApiProperty({ example: 'paper_size' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  key: string;

  @ApiProperty({ example: 'Paper Size' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiProperty({ enum: InputType })
  @IsEnum(InputType)
  inputType: InputType;

  @ApiProperty({ enum: ValueType })
  @IsEnum(ValueType)
  valueType: ValueType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  defaultValue?: string;

  @ApiPropertyOptional({ enum: PricingRole })
  @IsOptional()
  @IsEnum(PricingRole)
  pricingRole?: PricingRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unitLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  minValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maxValue?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  stepValue?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
