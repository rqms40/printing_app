import { IsString, IsInt, IsNotEmpty, IsPositive, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsInt()
  @IsPositive()
  conversationId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content: string;
}
