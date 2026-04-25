import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { SenderRole } from './entities/chat-message.entity';
import { ConversationType, Conversation } from './entities/conversation.entity';

@WebSocketGateway({ namespace: '/ws/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly botInFlight = new Set<number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: number;
        role?: string;
      }>(token);
      client.data.userId = payload.sub;
      client.data.role = payload.role ?? 'customer';
      if (payload.role === 'admin') {
        void client.join('admin_inbox');
      }
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('join-conversation')
  handleJoinConversation(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    void client.join(`conversation:${data.conversationId}`);
    return { event: 'joined', data: { conversationId: data.conversationId } };
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    void client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody() data: { conversationId: number; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const userId = client.data.userId as number;
    const role = (client.data.role as string) ?? 'customer';
    const senderRole =
      role === 'admin'
        ? SenderRole.ADMIN
        : role === 'driver'
          ? SenderRole.RIDER
          : SenderRole.CUSTOMER;

    const msg = await this.chatService.saveMessage(
      data.conversationId,
      userId,
      senderRole,
      data.content,
    );
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('message-received', msg);

    this.triggerBotIfNeeded(data.conversationId, data.content).catch((err) => {
      console.error('[ChatGateway] bot trigger error', err);
    });

    return { status: 'ok' };
  }

  private async triggerBotIfNeeded(
    conversationId: number,
    userMessage: string,
  ) {
    if (this.botInFlight.has(conversationId)) return;
    const conv = await this.chatService.findConversation(conversationId);
    if (!conv || conv.type !== ConversationType.AI) return;

    this.botInFlight.add(conversationId);
    try {
      this.server.to(`conversation:${conversationId}`).emit('bot-typing', {
        conversationId,
      });

      const botText = await this.chatService.getBotResponse(
        conversationId,
        userMessage,
      );
      const botMsg = await this.chatService.saveMessage(
        conversationId,
        null,
        SenderRole.BOT,
        botText,
      );
      this.server
        .to(`conversation:${conversationId}`)
        .emit('bot-response', botMsg);
    } finally {
      this.botInFlight.delete(conversationId);
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const role = (client.data.role as string) ?? 'customer';
    const senderRole =
      role === 'admin'
        ? SenderRole.ADMIN
        : role === 'driver'
          ? SenderRole.RIDER
          : SenderRole.CUSTOMER;
    client.to(`conversation:${data.conversationId}`).emit('user-typing', {
      conversationId: data.conversationId,
      senderRole,
    });
  }

  @SubscribeMessage('read-messages')
  async handleReadMessages(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: Socket,
  ) {
    if (!client.data.userId) return;
    await this.chatService.markMessagesRead(data.conversationId);
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('messages-read', { conversationId: data.conversationId, readAt: new Date() });
  }

  notifyNewConversation(
    conv: Conversation,
    customerName: string,
  ) {
    this.server.to('admin_inbox').emit('new-conversation', {
      conversationId: conv.id,
      customerId: conv.customerId,
      customerName,
      type: conv.type,
      orderId: conv.orderId ?? null,
    });
  }
}
