import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class OpenIssueDto {
  @ApiProperty()
  @IsInt()
  @IsPositive()
  orderId: number;

  @ApiProperty({ example: 'print_defect' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category: string;

  @ApiPropertyOptional({
    description: 'Evidence refs (file ids, photo urls, notes)',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  evidence?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
