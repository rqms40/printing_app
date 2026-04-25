import { IsEnum, IsOptional, IsInt, IsPositive } from 'class-validator';
import { ConversationType } from '../entities/conversation.entity';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsOptional()
  @IsInt()
  @IsPositive()
  orderId?: number;
}
