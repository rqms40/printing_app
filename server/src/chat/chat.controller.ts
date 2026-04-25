import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { UsersService } from '../users/users.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationType } from './entities/conversation.entity';
import type { Conversation } from './entities/conversation.entity';
import type { ChatMessage } from './entities/chat-message.entity';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly usersService: UsersService,
  ) {}

  @Post('conversations')
  async createConversation(
    @Request() req: { user: { id: number } },
    @Body() dto: CreateConversationDto,
  ): Promise<Conversation> {
    const conv = await this.chatService.createConversation(req.user.id, dto);
    if (dto.type !== ConversationType.AI) {
      const user = await this.usersService.findById(req.user.id);
      this.chatGateway.notifyNewConversation(
        conv,
        user?.fullName ?? user?.nickname ?? 'Customer',
      );
    }
    return conv;
  }

  @Get('conversations')
  getConversations(
    @Request() req: { user: { id: number } },
  ): Promise<Conversation[]> {
    return this.chatService.getConversations(req.user.id);
  }

  @Get('conversations/:id/messages')
  getMessages(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ): Promise<ChatMessage[]> {
    return this.chatService.getMessages(+id, +page, +limit);
  }

  @Get('admin/conversations')
  @UseGuards(RolesGuard)
  @Roles('admin')
  getAdminConversations(
    @Query('status') status?: string,
    @Query('type') type?: string,
  ): Promise<Conversation[]> {
    return this.chatService.getAdminConversations(status, type);
  }

  @Patch('conversations/:id/assign')
  @UseGuards(RolesGuard)
  @Roles('admin')
  assignConversation(
    @Param('id') id: string,
    @Request() req: { user: { id: number } },
  ): Promise<Conversation> {
    return this.chatService.assignAdmin(+id, req.user.id);
  }

  @Patch('conversations/:id/close')
  @UseGuards(RolesGuard)
  @Roles('admin')
  closeConversation(@Param('id') id: string): Promise<Conversation> {
    return this.chatService.closeConversation(+id);
  }
}
