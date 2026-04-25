import { IsString, IsInt, IsNotEmpty } from 'class-validator';

export class SendMessageDto {
  @IsInt()
  conversationId: number;

  @IsString()
  @IsNotEmpty()
  content: string;
}
