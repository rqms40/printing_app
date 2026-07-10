import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService, type ChatActorRole } from './chat.service';
import { SenderRole } from './entities/chat-message.entity';
import { ConversationType, Conversation } from './entities/conversation.entity';

interface ChatSocketData {
  userId?: number;
  role?: string;
}

type ChatSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  ChatSocketData
>;

@WebSocketGateway({ namespace: '/ws/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly botInFlight = new Set<number>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: ChatSocket) {
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
  async handleJoinConversation(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: ChatSocket,
  ) {
    await this.assertCanAccessConversation(client, data.conversationId);
    await client.join(`conversation:${data.conversationId}`);
    await this.assertCanAccessConversation(client, data.conversationId);
    return { event: 'joined', data: { conversationId: data.conversationId } };
  }

  @SubscribeMessage('leave-conversation')
  handleLeaveConversation(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: ChatSocket,
  ) {
    void client.leave(`conversation:${data.conversationId}`);
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @MessageBody()
    data: {
      conversationId: number;
      content?: string;
      attachmentFileId?: number;
      attachmentMimeType?: string;
    },
    @ConnectedSocket() client: ChatSocket,
  ) {
    const role = this.getActor(client).role;
    const senderRole =
      role === 'admin'
        ? SenderRole.ADMIN
        : role === 'rider'
          ? SenderRole.RIDER
          : SenderRole.CUSTOMER;

    const trimmedContent = (data.content ?? '').trim();
    if (!trimmedContent && !data.attachmentFileId) {
      throw new WsException('Message must have content or attachment');
    }

    const msg = await this.runAsActor(
      client,
      data.conversationId,
      (userId, actorRole) =>
        this.chatService.saveMessageForActor(
          data.conversationId,
          userId,
          actorRole,
          trimmedContent,
          data.attachmentFileId ?? null,
          data.attachmentMimeType ?? null,
        ),
    );
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('message-received', msg);

    if (senderRole === SenderRole.CUSTOMER && trimmedContent) {
      this.triggerBotIfNeeded(data.conversationId, trimmedContent).catch(
        (err) => {
          console.error('[ChatGateway] bot trigger error', err);
        },
      );
    }

    return { status: 'ok', messageId: msg.id };
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
  async handleTyping(
    @MessageBody() data: { conversationId: number },
    @ConnectedSocket() client: ChatSocket,
  ) {
    await this.assertCanAccessConversation(client, data.conversationId);
    const role = client.data.role ?? 'customer';
    const senderRole =
      role === 'admin'
        ? SenderRole.ADMIN
        : role === 'rider'
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
    @ConnectedSocket() client: ChatSocket,
  ) {
    if (!client.data.userId) return;
    await this.runAsActor(client, data.conversationId, (userId, role) =>
      this.chatService.markMessagesReadForActor(
        data.conversationId,
        userId,
        role,
      ),
    );
    this.server
      .to(`conversation:${data.conversationId}`)
      .emit('messages-read', {
        conversationId: data.conversationId,
        readAt: new Date(),
      });
  }

  notifyNewConversation(conv: Conversation, customerName: string) {
    this.server.to('admin_inbox').emit('new-conversation', {
      conversationId: conv.id,
      customerId: conv.customerId,
      customerName,
      type: conv.type,
      orderId: conv.orderId ?? null,
    });
  }

  notifyConversationClosed(conversationIds: number[]): void {
    for (const conversationId of conversationIds) {
      const room = `conversation:${conversationId}`;
      this.server.to(room).emit('conversation-closed', { conversationId });
      this.server.in(room).socketsLeave(room);
    }
  }

  private async assertCanAccessConversation(
    client: ChatSocket,
    conversationId: number,
  ): Promise<Conversation> {
    return this.runAsActor(client, conversationId, (userId, role) =>
      this.chatService.assertCanAccessConversationForActor(
        conversationId,
        userId,
        role,
      ),
    );
  }

  private getActor(client: ChatSocket): {
    userId: number;
    role: ChatActorRole;
  } {
    const userId = client.data.userId;
    if (!userId) {
      throw new WsException('Unauthorized');
    }
    const rawRole = client.data.role ?? 'customer';
    if (rawRole !== 'admin' && rawRole !== 'customer' && rawRole !== 'rider') {
      throw new WsException('Forbidden');
    }
    return { userId, role: rawRole };
  }

  private async runAsActor<T>(
    client: ChatSocket,
    conversationId: number,
    action: (userId: number, role: ChatActorRole) => Promise<T>,
  ): Promise<T> {
    const actor = this.getActor(client);
    try {
      return await action(actor.userId, actor.role);
    } catch (error) {
      if (actor.role === 'rider') {
        void client.leave(`conversation:${conversationId}`);
      }
      if (error instanceof WsException) throw error;
      throw new WsException(
        error instanceof Error ? error.message : 'Forbidden',
      );
    }
  }
}
