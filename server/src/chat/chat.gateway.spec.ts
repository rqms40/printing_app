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
      chatService.saveMessage
        .mockResolvedValueOnce({ id: 10, content: 'Hello' })
        .mockResolvedValueOnce({ id: 11, senderRole: 'bot', content: 'Hi there!' });
      chatService.findConversation.mockResolvedValue({ type: ConversationType.AI });
      chatService.getBotResponse.mockResolvedValue('Hi there!');

      await gateway.handleSendMessage({ conversationId: 3, content: 'Hello' }, socket as any);

      const emitCalls = server.emit.mock.calls.map((c: string[]) => c[0]);
      expect(emitCalls).toContain('bot-typing');
      expect(emitCalls).toContain('bot-response');
      const botTypingIndex = emitCalls.indexOf('bot-typing');
      const botResponseIndex = emitCalls.indexOf('bot-response');
      expect(botTypingIndex).toBeLessThan(botResponseIndex);
    });
  });

  describe('handleReadMessages', () => {
    it('marks messages read and emits messages-read', async () => {
      chatService.markMessagesRead.mockResolvedValue(undefined);
      await gateway.handleReadMessages({ conversationId: 5 });
      expect(chatService.markMessagesRead).toHaveBeenCalledWith(5);
      expect(server.to).toHaveBeenCalledWith('conversation:5');
      expect(server.emit).toHaveBeenCalledWith('messages-read', expect.objectContaining({
        conversationId: 5,
      }));
    });
  });
});
