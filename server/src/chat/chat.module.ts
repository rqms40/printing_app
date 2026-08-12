import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Conversation } from './entities/conversation.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatSettings } from './entities/chat-settings.entity';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { OpenRouterService } from './openrouter.service';
import { UsersModule } from '../users/users.module';
import { Order } from '../orders/entities/order.entity';
import { RealtimeSessionsModule } from '../common/realtime/realtime-sessions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ChatMessage, Order, ChatSettings]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
    }),
    UsersModule,
    RealtimeSessionsModule,
  ],
  providers: [ChatGateway, ChatService, OpenRouterService],
  controllers: [ChatController],
  exports: [ChatGateway, ChatService],
})
export class ChatModule {}
