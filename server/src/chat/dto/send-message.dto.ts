import {
  IsString,
  IsInt,
  IsPositive,
  IsOptional,
  MaxLength,
} from 'class-validator';

export class SendMessageDto {
  @IsInt()
  @IsPositive()
  conversationId: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  attachmentFileId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  attachmentMimeType?: string;
}
