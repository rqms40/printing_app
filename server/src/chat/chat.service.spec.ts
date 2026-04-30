import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ChatService } from './chat.service';
import {
  Conversation,
  ConversationStatus,
  ConversationType,
} from './entities/conversation.entity';
import { ChatMessage, SenderRole } from './entities/chat-message.entity';
import { OpenRouterService } from './openrouter.service';
import { GRIDBOT_REFUSAL, GRIDBOT_SYSTEM_PROMPT } from './gridbot.prompt';

const makeConvRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  update: jest.fn(),
});
const makeMsgRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
});

describe('ChatService', () => {
  let service: ChatService;
  let convRepo: ReturnType<typeof makeConvRepo>;
  let msgRepo: ReturnType<typeof makeMsgRepo>;
  let openRouter: { complete: jest.Mock };

  beforeEach(async () => {
    convRepo = makeConvRepo();
    msgRepo = makeMsgRepo();
    openRouter = { complete: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Conversation), useValue: convRepo },
        { provide: getRepositoryToken(ChatMessage), useValue: msgRepo },
        { provide: OpenRouterService, useValue: openRouter },
      ],
    }).compile();
    service = module.get(ChatService);
  });

  describe('createConversation', () => {
    it('creates and returns a conversation', async () => {
      const built = { id: 1, customerId: 5, type: ConversationType.ADMIN };
      convRepo.create.mockReturnValue(built);
      convRepo.save.mockResolvedValue({
        ...built,
        status: ConversationStatus.OPEN,
      });

      const result = await service.createConversation(5, {
        type: ConversationType.ADMIN,
      });

      expect(convRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 5,
          type: ConversationType.ADMIN,
          status: ConversationStatus.OPEN,
        }),
      );
      expect(result.status).toBe(ConversationStatus.OPEN);
    });

    it('does not persist assignedRiderId on non-rider conversations', async () => {
      const built = {
        id: 1,
        customerId: 5,
        type: ConversationType.ADMIN,
        assignedRiderId: null,
      };
      convRepo.create.mockReturnValue(built);
      convRepo.save.mockResolvedValue(built);

      await service.createConversation(5, {
        type: ConversationType.ADMIN,
        assignedRiderId: 12,
      });

      expect(convRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: ConversationType.ADMIN,
          assignedRiderId: null,
        }),
      );
    });
  });

  describe('saveMessage', () => {
    it('saves message and updates conversation updatedAt', async () => {
      const msg = { id: 1, conversationId: 10, content: 'Hello' };
      msgRepo.create.mockReturnValue(msg);
      msgRepo.save.mockResolvedValue(msg);
      convRepo.update.mockResolvedValue(undefined);

      const result = await service.saveMessage(
        10,
        5,
        SenderRole.CUSTOMER,
        'Hello',
      );
      expect(msgRepo.save).toHaveBeenCalled();
      expect(convRepo.update).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ updatedAt: expect.any(Date) }),
      );
      expect(result).toEqual(msg);
    });
  });

  describe('getBotResponse', () => {
    it('fetches history and calls OpenRouter with system prompt', async () => {
      msgRepo.find.mockResolvedValue([
        { senderRole: SenderRole.CUSTOMER, content: 'What do you offer?' },
      ]);
      openRouter.complete.mockResolvedValue('We offer paper and 3D printing!');

      const result = await service.getBotResponse(1, 'What do you offer?');

      expect(msgRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: 1 },
          order: { createdAt: 'DESC' },
          take: 10,
        }),
      );
      expect(openRouter.complete).toHaveBeenCalledWith([
        { role: 'system', content: GRIDBOT_SYSTEM_PROMPT },
        { role: 'user', content: 'What do you offer?' },
      ]);
      expect(result).toBe('We offer paper and 3D printing!');
    });

    it('uses the GridBot guardrail system prompt that scopes the bot to GRID/printing', () => {
      expect(GRIDBOT_SYSTEM_PROMPT).toContain('GridBot');
      expect(GRIDBOT_SYSTEM_PROMPT).toContain('GRID');
      expect(GRIDBOT_SYSTEM_PROMPT).toContain('REFUSAL RULE');
      expect(GRIDBOT_SYSTEM_PROMPT).toContain(GRIDBOT_REFUSAL);
      expect(GRIDBOT_REFUSAL).toMatch(/only help with questions about GRID/i);
    });

    it('maps bot messages to assistant role and reverses DESC history to chronological order', async () => {
      msgRepo.find.mockResolvedValue([
        // DESC order: newest first
        {
          senderRole: SenderRole.BOT,
          content: 'We offer paper and 3D printing!',
        },
        { senderRole: SenderRole.CUSTOMER, content: 'What do you offer?' },
      ]);
      openRouter.complete.mockResolvedValue('Great question!');

      await service.getBotResponse(1, 'Follow-up');

      const callArg = openRouter.complete.mock.calls[0][0] as Array<{
        role: string;
        content: string;
      }>;
      // system prompt first
      expect(callArg[0].role).toBe('system');
      // then chronological order: customer question before bot response
      expect(callArg[1]).toEqual({
        role: 'user',
        content: 'What do you offer?',
      });
      expect(callArg[2]).toEqual({
        role: 'assistant',
        content: 'We offer paper and 3D printing!',
      });
    });
  });

  describe('assignAdmin', () => {
    it('sets assignedAdminId and status=assigned', async () => {
      const updated = {
        id: 1,
        assignedAdminId: 99,
        status: ConversationStatus.ASSIGNED,
      };
      convRepo.update.mockResolvedValue(undefined);
      convRepo.findOneOrFail.mockResolvedValue(updated);

      const result = await service.assignAdmin(1, 99);
      expect(convRepo.update).toHaveBeenCalledWith(1, {
        assignedAdminId: 99,
        status: ConversationStatus.ASSIGNED,
      });
      expect(convRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['customer'],
      });
      expect(result.status).toBe(ConversationStatus.ASSIGNED);
    });

    it('propagates error when conversation not found after assignAdmin', async () => {
      convRepo.update.mockResolvedValue(undefined);
      convRepo.findOneOrFail.mockRejectedValue(new Error('Entity not found'));

      await expect(service.assignAdmin(999, 1)).rejects.toThrow(
        'Entity not found',
      );
    });
  });

  describe('closeConversation', () => {
    it('sets status=closed and closedAt', async () => {
      const closed = {
        id: 1,
        status: ConversationStatus.CLOSED,
        closedAt: new Date(),
      };
      convRepo.update.mockResolvedValue(undefined);
      convRepo.findOneOrFail.mockResolvedValue(closed);

      const result = await service.closeConversation(1);
      expect(convRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          status: ConversationStatus.CLOSED,
          closedAt: expect.any(Date),
        }),
      );
      expect(convRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['customer'],
      });
      expect(result.status).toBe(ConversationStatus.CLOSED);
    });

    it('propagates error when conversation not found after closeConversation', async () => {
      convRepo.update.mockResolvedValue(undefined);
      convRepo.findOneOrFail.mockRejectedValue(new Error('Entity not found'));

      await expect(service.closeConversation(999)).rejects.toThrow(
        'Entity not found',
      );
    });
  });

  describe('markMessagesRead', () => {
    it('bulk-updates isRead on unread messages', async () => {
      msgRepo.update.mockResolvedValue(undefined);
      await service.markMessagesRead(5);
      expect(msgRepo.update).toHaveBeenCalledWith(
        { conversationId: 5, isRead: false },
        expect.objectContaining({ isRead: true, readAt: expect.any(Date) }),
      );
    });
  });
});
