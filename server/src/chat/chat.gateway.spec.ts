import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { SenderRole } from './entities/chat-message.entity';
import { ConversationType } from './entities/conversation.entity';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user.entity';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';

const makeSocket = (overrides: Partial<{ auth: any; data: any }> = {}) => ({
  id: 'socket-1',
  handshake: { auth: overrides.auth ?? { token: 'valid-token' } },
  data: overrides.data ?? {},
  disconnect: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
});

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  let chatService: {
    saveMessage: jest.Mock;
    saveMessageForActor: jest.Mock;
    findConversation: jest.Mock;
    getBotResponse: jest.Mock;
    markMessagesRead: jest.Mock;
    markMessagesReadForActor: jest.Mock;
    assertCanAccessConversationForActor: jest.Mock;
  };
  let jwtService: { verifyAsync: jest.Mock };
  let usersService: { findSocketIdentity: jest.Mock };
  let realtimeSessions: { register: jest.Mock };
  let server: {
    to: jest.Mock;
    in: jest.Mock;
    emit: jest.Mock;
    socketsLeave: jest.Mock;
  };

  beforeEach(async () => {
    chatService = {
      saveMessage: jest.fn(),
      saveMessageForActor: jest.fn(),
      findConversation: jest.fn(),
      getBotResponse: jest.fn(),
      markMessagesRead: jest.fn(),
      markMessagesReadForActor: jest.fn(),
      assertCanAccessConversationForActor: jest.fn().mockResolvedValue({}),
    };
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 42, role: 'client' }),
    };
    usersService = {
      findSocketIdentity: jest.fn(async (id: number) => ({
        id,
        role: UserRole.CLIENT,
        isActive: true,
      })),
    };
    realtimeSessions = { register: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: JwtService, useValue: jwtService },
        { provide: UsersService, useValue: usersService },
        { provide: RealtimeSessionRegistry, useValue: realtimeSessions },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    server = {
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      socketsLeave: jest.fn(),
    };
    (gateway as any).server = server;
  });

  describe('handleConnection', () => {
    it('disconnects client with no token', async () => {
      const socket = makeSocket({ auth: {} });
      await gateway.handleConnection(socket as any);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('sets userId and role on socket data', async () => {
      const socket = makeSocket();
      await gateway.handleConnection(socket as any);
      expect(socket.data.userId).toBe(42);
      expect(socket.data.role).toBe('client');
      expect(realtimeSessions.register).toHaveBeenCalledWith(42, socket);
      expect(socket.emit).toHaveBeenCalledWith('session-ready', {
        userId: 42,
      });
    });

    it('joins admin_inbox room for admin role', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 1, role: 'ops_admin' });
      usersService.findSocketIdentity.mockResolvedValue({
        id: 1,
        role: UserRole.OPS_ADMIN,
        isActive: true,
      });
      const socket = makeSocket();
      await gateway.handleConnection(socket as any);
      expect(socket.join).toHaveBeenCalledWith('admin_inbox');
    });

    it('disconnects client when JWT verification fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));
      const socket = makeSocket();
      await gateway.handleConnection(socket as any);
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects an inactive database identity', async () => {
      usersService.findSocketIdentity.mockResolvedValue({
        id: 42,
        role: UserRole.CLIENT,
        isActive: false,
      });
      const socket = makeSocket();

      await gateway.handleConnection(socket as any);

      expect(socket.disconnect).toHaveBeenCalled();
      expect(realtimeSessions.register).not.toHaveBeenCalled();
    });
  });

  describe('handleJoinConversation', () => {
    it('joins the conversation room for the owning customer', async () => {
      const socket = makeSocket({ data: { userId: 1, role: 'client' } });
      chatService.findConversation.mockResolvedValue({ customerId: 1 });
      await gateway.handleJoinConversation(
        { conversationId: 5 },
        socket as any,
      );
      expect(socket.join).toHaveBeenCalledWith('conversation:5');
    });

    it('rejects room joins by non-owner customers', async () => {
      const socket = makeSocket({ data: { userId: 1, role: 'client' } });
      chatService.assertCanAccessConversationForActor.mockRejectedValue(
        new Error('Forbidden'),
      );

      await expect(
        gateway.handleJoinConversation({ conversationId: 5 }, socket as any),
      ).rejects.toThrow('Forbidden');
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('rejects assigned rider access when the socket role is not rider', async () => {
      const socket = makeSocket({ data: { userId: 12, role: 'client' } });
      chatService.assertCanAccessConversationForActor.mockRejectedValue(
        new Error('Forbidden'),
      );

      await expect(
        gateway.handleJoinConversation({ conversationId: 5 }, socket as any),
      ).rejects.toThrow('Forbidden');
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('rejects a matching rider after the conversation is closed', async () => {
      usersService.findSocketIdentity.mockResolvedValue({
        id: 12,
        role: UserRole.RIDER,
        isActive: true,
      });
      const socket = makeSocket({ data: { userId: 12, role: 'rider' } });
      chatService.assertCanAccessConversationForActor.mockRejectedValue(
        new Error('Forbidden'),
      );

      await expect(
        gateway.handleJoinConversation({ conversationId: 5 }, socket as any),
      ).rejects.toThrow('Forbidden');
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('handleSendMessage', () => {
    it('disconnects a newly held customer before accepting a message', async () => {
      usersService.findSocketIdentity.mockResolvedValue({
        id: 1,
        role: UserRole.CLIENT,
        isActive: false,
      });
      const socket = makeSocket({ data: { userId: 1, role: 'client' } });

      await expect(
        gateway.handleSendMessage(
          { conversationId: 5, content: 'After hold' },
          socket as any,
        ),
      ).rejects.toThrow('Unauthorized');

      expect(socket.disconnect).toHaveBeenCalled();
      expect(chatService.saveMessageForActor).not.toHaveBeenCalled();
    });
    it('denies future messages from a rider after conversation closure', async () => {
      usersService.findSocketIdentity.mockResolvedValue({
        id: 12,
        role: UserRole.RIDER,
        isActive: true,
      });
      const socket = makeSocket({ data: { userId: 12, role: 'rider' } });
      chatService.saveMessageForActor.mockRejectedValue(new Error('Forbidden'));

      await expect(
        gateway.handleSendMessage(
          { conversationId: 5, content: 'Still here' },
          socket as any,
        ),
      ).rejects.toThrow('Forbidden');
      expect(chatService.saveMessage).not.toHaveBeenCalled();
      expect(socket.leave).toHaveBeenCalledWith('conversation:5');
    });

    it('saves message and broadcasts message-received', async () => {
      const socket = makeSocket({ data: { userId: 1, role: 'client' } });
      const saved = { id: 10, conversationId: 5, content: 'Hi' };
      chatService.saveMessageForActor.mockResolvedValue(saved);
      chatService.findConversation.mockResolvedValue({
        customerId: 1,
        type: ConversationType.ADMIN,
      });

      await gateway.handleSendMessage(
        { conversationId: 5, content: 'Hi' },
        socket as any,
      );

      expect(chatService.saveMessageForActor).toHaveBeenCalledWith(
        5,
        1,
        'customer',
        'Hi',
        null,
        null,
      );
      expect(server.to).toHaveBeenCalledWith('conversation:5');
      expect(server.emit).toHaveBeenCalledWith('message-received', saved);
    });

    it('emits bot-typing then bot-response for AI conversations', async () => {
      const socket = makeSocket({ data: { userId: 1, role: 'client' } });
      const botMsg = { id: 11, senderRole: 'bot', content: 'Hi there!' };
      chatService.saveMessageForActor.mockResolvedValueOnce({
        id: 10,
        content: 'Hello',
      });
      chatService.saveMessage.mockResolvedValueOnce(botMsg);
      chatService.findConversation.mockResolvedValue({
        customerId: 1,
        type: ConversationType.AI,
      });
      chatService.getBotResponse.mockResolvedValue('Hi there!');

      await gateway.handleSendMessage(
        { conversationId: 3, content: 'Hello' },
        socket as any,
      );
      // Flush microtask queue so fire-and-forget triggerBotIfNeeded completes
      await new Promise((r) => setImmediate(r));

      const emitCalls = server.emit.mock.calls.map((c: string[]) => c[0]);
      expect(emitCalls).toContain('bot-typing');
      expect(emitCalls).toContain('bot-response');
      const botTypingIndex = emitCalls.indexOf('bot-typing');
      const botResponseIndex = emitCalls.indexOf('bot-response');
      expect(botTypingIndex).toBeLessThan(botResponseIndex);
      expect(server.emit).toHaveBeenCalledWith('bot-response', botMsg);
    });

    it('emits a fallback bot-response when the bot pipeline fails', async () => {
      const socket = makeSocket({ data: { userId: 1, role: 'client' } });
      chatService.saveMessageForActor.mockResolvedValueOnce({
        id: 10,
        content: 'Hello',
      });
      chatService.saveMessage.mockImplementation(
        (_convId, _senderId, senderRole, content) =>
          Promise.resolve({ id: 11, senderRole, content }),
      );
      chatService.findConversation.mockResolvedValue({
        customerId: 1,
        type: ConversationType.AI,
      });
      chatService.getBotResponse.mockRejectedValue(
        new Error('OPENROUTER_API_KEY is not configured'),
      );
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await gateway.handleSendMessage(
        { conversationId: 3, content: 'Hello' },
        socket as any,
      );
      await new Promise((r) => setImmediate(r));

      // The customer must never be left on a dangling bot-typing indicator:
      // a fallback bot message is persisted and broadcast instead.
      expect(chatService.saveMessage).toHaveBeenCalledWith(
        3,
        null,
        SenderRole.BOT,
        expect.stringContaining('GridBot is temporarily unavailable'),
      );
      expect(server.emit).toHaveBeenCalledWith(
        'bot-response',
        expect.objectContaining({
          content: expect.stringContaining(
            'GridBot is temporarily unavailable',
          ),
        }),
      );
      consoleError.mockRestore();
    });

    it('does not trigger GridBot for admin messages in AI conversations', async () => {
      usersService.findSocketIdentity.mockResolvedValue({
        id: 7,
        role: UserRole.OPS_ADMIN,
        isActive: true,
      });
      const socket = makeSocket({ data: { userId: 7, role: 'ops_admin' } });
      const saved = { id: 12, conversationId: 3, content: 'I can help' };
      chatService.saveMessageForActor.mockResolvedValue(saved);
      chatService.findConversation.mockResolvedValue({
        customerId: 1,
        type: ConversationType.AI,
      });

      await gateway.handleSendMessage(
        { conversationId: 3, content: 'I can help' },
        socket as any,
      );
      await new Promise((r) => setImmediate(r));

      expect(chatService.getBotResponse).not.toHaveBeenCalled();
      expect(server.emit).not.toHaveBeenCalledWith(
        'bot-typing',
        expect.anything(),
      );
    });
  });

  describe('handleReadMessages', () => {
    it('marks messages read and emits messages-read', async () => {
      const socket = makeSocket({ data: { userId: 7, role: 'client' } });
      chatService.markMessagesReadForActor.mockResolvedValue(undefined);
      await gateway.handleReadMessages({ conversationId: 5 }, socket as any);
      expect(chatService.markMessagesReadForActor).toHaveBeenCalledWith(
        5,
        7,
        'customer',
      );
      expect(server.to).toHaveBeenCalledWith('conversation:5');
      expect(server.emit).toHaveBeenCalledWith(
        'messages-read',
        expect.objectContaining({
          conversationId: 5,
        }),
      );
    });

    it('skips processing when socket has no userId', async () => {
      const socket = makeSocket({ data: {} });
      await gateway.handleReadMessages({ conversationId: 5 }, socket as any);
      expect(chatService.markMessagesReadForActor).not.toHaveBeenCalled();
    });
  });

  describe('handleTyping', () => {
    it('broadcasts user-typing with mapped SenderRole to room peers (not sender)', async () => {
      usersService.findSocketIdentity.mockResolvedValue({
        id: 1,
        role: UserRole.OPS_ADMIN,
        isActive: true,
      });
      const socket = makeSocket({ data: { userId: 1, role: 'ops_admin' } });
      chatService.findConversation.mockResolvedValue({ customerId: 42 });
      await gateway.handleTyping({ conversationId: 7 }, socket as any);
      expect(socket.to).toHaveBeenCalledWith('conversation:7');
      const toResult = socket.to.mock.results[0].value as jest.Mock & {
        emit: jest.Mock;
      };
      expect(toResult.emit).toHaveBeenCalledWith('user-typing', {
        conversationId: 7,
        senderRole: SenderRole.ADMIN,
      });
    });

    it('maps rider role to RIDER in user-typing payload', async () => {
      usersService.findSocketIdentity.mockResolvedValue({
        id: 2,
        role: UserRole.RIDER,
        isActive: true,
      });
      const socket = makeSocket({ data: { userId: 2, role: 'rider' } });
      chatService.findConversation.mockResolvedValue({
        type: ConversationType.RIDER,
        assignedRiderId: 2,
      });
      await gateway.handleTyping({ conversationId: 8 }, socket as any);
      expect(socket.to).toHaveBeenCalledWith('conversation:8');
      const toResult = socket.to.mock.results[0].value as jest.Mock & {
        emit: jest.Mock;
      };
      expect(toResult.emit).toHaveBeenCalledWith('user-typing', {
        conversationId: 8,
        senderRole: SenderRole.RIDER,
      });
    });
  });

  describe('handleLeaveConversation', () => {
    it('leaves the conversation room', () => {
      const socket = makeSocket({ data: { userId: 1, role: 'client' } });
      gateway.handleLeaveConversation({ conversationId: 9 }, socket as any);
      expect(socket.leave).toHaveBeenCalledWith('conversation:9');
    });
  });

  describe('notifyNewConversation', () => {
    it('emits new-conversation to admin_inbox with correct payload', () => {
      const conv = {
        id: 100,
        customerId: 5,
        type: ConversationType.ADMIN,
        orderId: null,
      } as any;
      gateway.notifyNewConversation(conv, 'Alice');
      expect(server.to).toHaveBeenCalledWith('admin_inbox');
      expect(server.emit).toHaveBeenCalledWith('new-conversation', {
        conversationId: 100,
        customerId: 5,
        customerName: 'Alice',
        type: ConversationType.ADMIN,
        orderId: null,
      });
    });
  });

  describe('notifyConversationClosed', () => {
    it('notifies and removes every socket from closed conversation rooms', () => {
      const notifyConversationClosed = (gateway as any)
        .notifyConversationClosed;
      expect(notifyConversationClosed).toBeDefined();
      if (typeof notifyConversationClosed !== 'function') return;

      notifyConversationClosed.call(gateway, [5, 8]);

      expect(server.to).toHaveBeenCalledWith('conversation:5');
      expect(server.emit).toHaveBeenCalledWith('conversation-closed', {
        conversationId: 5,
      });
      expect(server.in).toHaveBeenCalledWith('conversation:5');
      expect(server.socketsLeave).toHaveBeenCalledWith('conversation:5');
      expect(server.in).toHaveBeenCalledWith('conversation:8');
      expect(server.socketsLeave).toHaveBeenCalledWith('conversation:8');
    });
  });
});
