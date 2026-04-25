import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { SenderRole } from './entities/chat-message.entity';
import { ConversationType } from './entities/conversation.entity';

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
    findConversation: jest.Mock;
    getBotResponse: jest.Mock;
    markMessagesRead: jest.Mock;
  };
  let jwtService: { verifyAsync: jest.Mock };
  let server: { to: jest.Mock; emit: jest.Mock };

  beforeEach(async () => {
    chatService = {
      saveMessage: jest.fn(),
      findConversation: jest.fn(),
      getBotResponse: jest.fn(),
      markMessagesRead: jest.fn(),
    };
    jwtService = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 42, role: 'customer' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: chatService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get(ChatGateway);
    server = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
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
      expect(socket.data.role).toBe('customer');
    });

    it('joins admin_inbox room for admin role', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 1, role: 'admin' });
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
  });

  describe('handleJoinConversation', () => {
    it('joins the conversation room', () => {
      const socket = makeSocket({ data: { userId: 1, role: 'customer' } });
      gateway.handleJoinConversation({ conversationId: 5 }, socket as any);
      expect(socket.join).toHaveBeenCalledWith('conversation:5');
    });
  });

  describe('handleSendMessage', () => {
    it('saves message and broadcasts message-received', async () => {
      const socket = makeSocket({ data: { userId: 1, role: 'customer' } });
      const saved = { id: 10, conversationId: 5, content: 'Hi' };
      chatService.saveMessage.mockResolvedValue(saved);
      chatService.findConversation.mockResolvedValue({ type: ConversationType.ADMIN });

      await gateway.handleSendMessage({ conversationId: 5, content: 'Hi' }, socket as any);

      expect(chatService.saveMessage).toHaveBeenCalledWith(5, 1, SenderRole.CUSTOMER, 'Hi');
      expect(server.to).toHaveBeenCalledWith('conversation:5');
      expect(server.emit).toHaveBeenCalledWith('message-received', saved);
    });

    it('emits bot-typing then bot-response for AI conversations', async () => {
      const socket = makeSocket({ data: { userId: 1, role: 'customer' } });
      const botMsg = { id: 11, senderRole: 'bot', content: 'Hi there!' };
      chatService.saveMessage
        .mockResolvedValueOnce({ id: 10, content: 'Hello' })
        .mockResolvedValueOnce(botMsg);
      chatService.findConversation.mockResolvedValue({ type: ConversationType.AI });
      chatService.getBotResponse.mockResolvedValue('Hi there!');

      await gateway.handleSendMessage({ conversationId: 3, content: 'Hello' }, socket as any);
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
  });

  describe('handleReadMessages', () => {
    it('marks messages read and emits messages-read', async () => {
      const socket = makeSocket({ data: { userId: 7, role: 'customer' } });
      chatService.markMessagesRead.mockResolvedValue(undefined);
      await gateway.handleReadMessages({ conversationId: 5 }, socket as any);
      expect(chatService.markMessagesRead).toHaveBeenCalledWith(5);
      expect(server.to).toHaveBeenCalledWith('conversation:5');
      expect(server.emit).toHaveBeenCalledWith('messages-read', expect.objectContaining({
        conversationId: 5,
      }));
    });

    it('skips processing when socket has no userId', async () => {
      const socket = makeSocket({ data: {} });
      await gateway.handleReadMessages({ conversationId: 5 }, socket as any);
      expect(chatService.markMessagesRead).not.toHaveBeenCalled();
    });
  });

  describe('handleTyping', () => {
    it('broadcasts user-typing with mapped SenderRole to room peers (not sender)', () => {
      const socket = makeSocket({ data: { userId: 1, role: 'admin' } });
      gateway.handleTyping({ conversationId: 7 }, socket as any);
      expect(socket.to).toHaveBeenCalledWith('conversation:7');
      const toResult = socket.to.mock.results[0].value as jest.Mock & { emit: jest.Mock };
      expect(toResult.emit).toHaveBeenCalledWith('user-typing', {
        conversationId: 7,
        senderRole: SenderRole.ADMIN,
      });
    });

    it('maps driver role to RIDER in user-typing payload', () => {
      const socket = makeSocket({ data: { userId: 2, role: 'driver' } });
      gateway.handleTyping({ conversationId: 8 }, socket as any);
      expect(socket.to).toHaveBeenCalledWith('conversation:8');
      const toResult = socket.to.mock.results[0].value as jest.Mock & { emit: jest.Mock };
      expect(toResult.emit).toHaveBeenCalledWith('user-typing', {
        conversationId: 8,
        senderRole: SenderRole.RIDER,
      });
    });
  });

  describe('handleLeaveConversation', () => {
    it('leaves the conversation room', () => {
      const socket = makeSocket({ data: { userId: 1, role: 'customer' } });
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
});
