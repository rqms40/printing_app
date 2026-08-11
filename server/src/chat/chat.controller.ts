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
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { ChatService, type ChatActorRole } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { UsersService } from '../users/users.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationType } from './entities/conversation.entity';
import type { Conversation } from './entities/conversation.entity';
import type { ChatMessage } from './entities/chat-message.entity';
import { isAdminRole, UserRole } from '../users/entities/user.entity';

type JwtUser = { sub: number; role: string; email: string };

function toChatActorRole(role: string): ChatActorRole {
  if (isAdminRole(role)) return 'admin';
  if (role === UserRole.RIDER || role === 'rider') return 'rider';
  return 'customer';
}

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
    @Request() req: { user: JwtUser },
    @Body() dto: CreateConversationDto,
  ): Promise<Conversation> {
    // Admin/supplier/client support threads should dedupe via open direct chat.
    if (
      dto.type === ConversationType.ADMIN &&
      dto.orderId == null &&
      (req.user.role === UserRole.CLIENT ||
        req.user.role === UserRole.SUPPLIER ||
        req.user.role === 'client' ||
        req.user.role === 'supplier')
    ) {
      return this.openSupportConversation(req);
    }

    const conv = await this.chatService.createConversation(req.user.sub, dto);
    if (dto.type !== ConversationType.AI) {
      const user = await this.usersService.findById(req.user.sub);
      this.chatGateway.notifyNewConversation(
        conv,
        user?.fullName ?? user?.nickname ?? 'Customer',
        user?.role ?? null,
      );
    }
    return conv;
  }

  /**
   * Open (or resume) a direct Human Support thread with ops/superadmin.
   * Used by suppliers and customers; shows in admin Live Chat / Support.
   */
  @Post('support')
  async openSupportConversation(
    @Request() req: { user: JwtUser },
  ): Promise<Conversation> {
    if (isAdminRole(req.user.role)) {
      throw new ForbiddenException(
        'Admins cannot open supplier/customer support as self',
      );
    }
    if (
      req.user.role !== UserRole.CLIENT &&
      req.user.role !== UserRole.SUPPLIER &&
      req.user.role !== 'client' &&
      req.user.role !== 'supplier' &&
      req.user.role !== UserRole.RIDER &&
      req.user.role !== 'rider'
    ) {
      throw new ForbiddenException();
    }

    const { conversation, created } =
      await this.chatService.getOrCreateDirectConversation(req.user.sub);
    if (created) {
      const user = await this.usersService.findById(req.user.sub);
      this.chatGateway.notifyNewConversation(
        conversation,
        user?.fullName ?? user?.nickname ?? 'User',
        user?.role ?? null,
      );
    }
    return conversation;
  }

  @Post('orders/:orderId/conversation')
  async openOrderConversation(
    @Param('orderId') orderId: string,
    @Request() req: { user: JwtUser },
  ): Promise<Conversation> {
    const orderRef = orderId.trim();
    if (!orderRef) {
      throw new BadRequestException('Invalid order id');
    }

    if (req.user.role === UserRole.RIDER || req.user.role === 'rider') {
      return this.chatService.getOrCreateRiderOrderConversation(
        req.user.sub,
        orderRef,
      );
    }

    if (req.user.role !== UserRole.CLIENT && req.user.role !== 'client') {
      throw new ForbiddenException();
    }

    return this.chatService.getOrCreateCustomerOrderConversation(
      req.user.sub,
      orderRef,
    );
  }

  @Get('conversations')
  getConversations(@Request() req: { user: JwtUser }): Promise<Conversation[]> {
    return this.chatService.getConversations(req.user.sub);
  }

  @Get('unread-count')
  async getUnreadCount(
    @Request() req: { user: JwtUser },
  ): Promise<{ count: number }> {
    const count = await this.chatService.getUnreadCount(req.user.sub);
    return { count };
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Request() req: { user: JwtUser },
  ): Promise<ChatMessage[]> {
    const cappedLimit = Math.min(+limit, 100);
    return this.chatService.getMessagesForActor(
      +id,
      req.user.sub,
      toChatActorRole(req.user.role),
      +page,
      cappedLimit,
    );
  }

  @Get('admin/conversations')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  getAdminConversations(
    @Query('status') status?: string,
    @Query('type') type?: string,
  ): Promise<Conversation[]> {
    return this.chatService.getAdminConversations(status, type);
  }

  @Patch('conversations/:id/assign')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  assignConversation(
    @Param('id') id: string,
    @Request() req: { user: JwtUser },
  ): Promise<Conversation> {
    return this.chatService.assignAdmin(+id, req.user.sub);
  }

  @Patch('conversations/:id/close')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  async closeConversation(@Param('id') id: string): Promise<Conversation> {
    const conversation = await this.chatService.closeConversation(+id);
    this.chatGateway.notifyConversationClosed([conversation.id]);
    return conversation;
  }

  @Post('admin/conversations/direct/:userId')
  @UseGuards(RolesGuard)
  @Roles('ops_admin', 'super_admin')
  async startDirectConversation(
    @Param('userId') userId: string,
  ): Promise<Conversation> {
    const { conversation, created } =
      await this.chatService.getOrCreateDirectConversation(+userId);
    if (created) {
      const user = await this.usersService.findById(+userId);
      this.chatGateway.notifyNewConversation(
        conversation,
        user?.fullName ?? user?.nickname ?? 'Customer',
        user?.role ?? null,
      );
    }
    return conversation;
  }
}
