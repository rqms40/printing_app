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
import { UsersService } from '../users/users.service';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';
import {
  authenticateRealtimeSocket,
  reauthorizeRealtimeSocket,
} from '../common/realtime/realtime-socket-auth';
import { UserRole } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FirebaseService } from '../firebase/firebase.service';

const CHAT_ACTOR_ROLE_BY_USER_ROLE: Record<UserRole, ChatActorRole> = {
  [UserRole.ADMIN]: 'admin',
  [UserRole.CUSTOMER]: 'customer',
  [UserRole.RIDER]: 'rider',
};

interface ChatSocketData {
  userId?: number;
  role?: UserRole;
}

interface ChatServerToClientEvents {
  'session-ready': (payload: { userId: number }) => void;
  'user-typing': (payload: {
    conversationId: number;
    senderRole: SenderRole;
  }) => void;
}

type ChatSocket = Socket<
  Record<string, never>,
  ChatServerToClientEvents,
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
    private readonly usersService: UsersService,
    private readonly realtimeSessions: RealtimeSessionRegistry,
    private readonly notificationsService: NotificationsService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async handleConnection(client: ChatSocket) {
    const identity = await authenticateRealtimeSocket(
      this.jwtService,
      this.usersService,
      client,
    );
    if (!identity) {
      client.disconnect();
      return;
    }
    if (identity.role === UserRole.ADMIN) {
      await client.join('admin_inbox');
    }
    this.realtimeSessions.register(identity.id, client);
    client.emit('session-ready', { userId: identity.id });
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
    const role = (await this.getActor(client)).role;
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

    if (senderRole === SenderRole.RIDER) {
      await this.notifyCustomerOfRiderMessage(
        data.conversationId,
        trimmedContent || 'Sent an attachment',
      );
    }

    if (senderRole === SenderRole.CUSTOMER && trimmedContent) {
      this.triggerBotIfNeeded(data.conversationId, trimmedContent).catch(
        (err) => {
          console.error('[ChatGateway] bot trigger error', err);
        },
      );
    }

    return { status: 'ok', messageId: msg.id };
  }

  private async notifyCustomerOfRiderMessage(
    conversationId: number,
    message: string,
  ): Promise<void> {
    const context = await this.chatService
      .getRiderMessageNotificationContext(conversationId)
      .catch((error) => {
        console.warn('Rider message notification context failed:', error);
        return null;
      });
    if (!context) return;

    const title = 'New message from your rider';
    const metadata = {
      conversationId,
      conversationType: 'rider',
      orderId: context.orderId,
      orderRef: context.orderRef,
    };
    try {
      await this.notificationsService.create({
        userId: context.customerId,
        title,
        message,
        type: 'rider_message',
        orderRef: context.orderRef,
        metadata,
      });
    } catch (error) {
      console.warn('Rider message persistent notification failed:', error);
    }

    if (context.customerFcmToken) {
      try {
        await this.firebaseService.sendToDevice(
          context.customerFcmToken,
          title,
          message,
          {
            type: 'rider_message',
            conversationId: String(conversationId),
            conversationType: 'rider',
            orderId: String(context.orderId),
            orderRef: context.orderRef,
          },
        );
      } catch (error) {
        console.warn('Rider message push notification failed:', error);
      }
    }
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

      let botText: string;
      try {
        botText = await this.chatService.getBotResponse(
          conversationId,
          userMessage,
        );
      } catch (err) {
        // Never leave the customer with a dangling bot-typing indicator —
        // e.g. OPENROUTER_API_KEY missing or the upstream model erroring.
        console.error('[ChatGateway] bot response failed', err);
        botText =
          'Sorry — GridBot is temporarily unavailable. Please try again ' +
          'in a moment, or reach Human Support from the chat menu.';
      }
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
    const role = (await this.getActor(client)).role;
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

  private async getActor(client: ChatSocket): Promise<{
    userId: number;
    role: ChatActorRole;
  }> {
    const identity = await reauthorizeRealtimeSocket(this.usersService, client);
    if (!identity) {
      client.disconnect();
      throw new WsException('Unauthorized');
    }
    return {
      userId: identity.id,
      role: CHAT_ACTOR_ROLE_BY_USER_ROLE[identity.role],
    };
  }

  private async runAsActor<T>(
    client: ChatSocket,
    conversationId: number,
    action: (userId: number, role: ChatActorRole) => Promise<T>,
  ): Promise<T> {
    const actor = await this.getActor(client);
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
