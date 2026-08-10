import { ForbiddenException } from '@nestjs/common';
import { ChatController } from './chat.controller';
import {
  ConversationStatus,
  ConversationType,
} from './entities/conversation.entity';
import type { ChatGateway } from './chat.gateway';
import type { ChatService } from './chat.service';
import type { UsersService } from '../users/users.service';

const makeController = () => {
  const chatService = {
    createConversation: jest.fn(),
    getOrCreateCustomerOrderConversation: jest.fn(),
    getOrCreateRiderOrderConversation: jest.fn(),
    findConversation: jest.fn(),
    getMessages: jest.fn(),
    getMessagesForActor: jest.fn(),
    getConversations: jest.fn(),
    getAdminConversations: jest.fn(),
    assignAdmin: jest.fn(),
    closeConversation: jest.fn(),
  };
  const chatGateway = {
    notifyNewConversation: jest.fn(),
    notifyConversationClosed: jest.fn(),
  };
  const usersService = {
    findById: jest.fn(),
  };

  return {
    controller: new ChatController(
      chatService as unknown as ChatService,
      chatGateway as unknown as ChatGateway,
      usersService as unknown as UsersService,
    ),
    chatService,
    chatGateway,
  };
};

describe('ChatController', () => {
  describe('openOrderConversation', () => {
    it('uses the customer order conversation flow for customers', async () => {
      const { controller, chatService } = makeController();
      const conversation = {
        id: 7,
        customerId: 5,
        type: ConversationType.RIDER,
        orderId: 42,
        assignedRiderId: 12,
      };
      chatService.getOrCreateCustomerOrderConversation.mockResolvedValue(
        conversation,
      );

      await expect(
        controller.openOrderConversation('42', {
          user: { sub: 5, role: 'client', email: 'customer@example.com' },
        }),
      ).resolves.toBe(conversation);
      expect(
        chatService.getOrCreateCustomerOrderConversation,
      ).toHaveBeenCalledWith(5, '42');
    });

    it('uses the rider order conversation flow for riders', async () => {
      const { controller, chatService } = makeController();
      const conversation = {
        id: 8,
        customerId: 5,
        type: ConversationType.RIDER,
        orderId: 42,
        assignedRiderId: 12,
      };
      chatService.getOrCreateRiderOrderConversation.mockResolvedValue(
        conversation,
      );

      await expect(
        controller.openOrderConversation('42', {
          user: { sub: 12, role: 'rider', email: 'rider@example.com' },
        }),
      ).resolves.toBe(conversation);
      expect(
        chatService.getOrCreateRiderOrderConversation,
      ).toHaveBeenCalledWith(12, '42');
    });
  });

  describe('getMessages', () => {
    it('allows an assigned rider to load rider conversation history', async () => {
      const { controller, chatService } = makeController();
      const messages = [
        {
          id: 1,
          conversationId: 10,
          senderrole: 'client',
          content: 'Where are you?',
        },
      ];
      chatService.getMessagesForActor.mockResolvedValue(messages);

      await expect(
        controller.getMessages('10', '1', '50', {
          user: { sub: 12, role: 'rider', email: 'rider@example.com' },
        }),
      ).resolves.toBe(messages);
      expect(chatService.getMessagesForActor).toHaveBeenCalledWith(
        10,
        12,
        'rider',
        1,
        50,
      );
    });

    it('rejects an unrelated rider from loading conversation history', async () => {
      const { controller, chatService } = makeController();
      chatService.getMessagesForActor.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        controller.getMessages('10', '1', '50', {
          user: { sub: 99, role: 'rider', email: 'other@example.com' },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(chatService.getMessagesForActor).toHaveBeenCalledWith(
        10,
        99,
        'rider',
        1,
        50,
      );
    });

    it('rejects matching assignedRiderId when the requester is not a rider', async () => {
      const { controller, chatService } = makeController();
      chatService.getMessagesForActor.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        controller.getMessages('10', '1', '50', {
          user: { sub: 12, role: 'client', email: 'not-rider@example.com' },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(chatService.getMessagesForActor).toHaveBeenCalledWith(
        10,
        12,
        'customer',
        1,
        50,
      );
    });

    it('rejects a previously assigned rider after the conversation is closed', async () => {
      const { controller, chatService } = makeController();
      chatService.getMessagesForActor.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        controller.getMessages('10', '1', '50', {
          user: { sub: 12, role: 'rider', email: 'old-rider@example.com' },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(chatService.getMessagesForActor).toHaveBeenCalledWith(
        10,
        12,
        'rider',
        1,
        50,
      );
    });

    it('preserves customer history access after a rider conversation closes', async () => {
      const { controller, chatService } = makeController();
      const messages = [{ id: 1, conversationId: 10 }];
      chatService.getMessagesForActor.mockResolvedValue(messages);

      await expect(
        controller.getMessages('10', '1', '50', {
          user: { sub: 5, role: 'client', email: 'customer@example.com' },
        }),
      ).resolves.toBe(messages);
      expect(chatService.getMessagesForActor).toHaveBeenCalledWith(
        10,
        5,
        'customer',
        1,
        50,
      );
    });
  });

  describe('closeConversation', () => {
    it('revokes live room membership after closing a conversation', async () => {
      const { controller, chatService, chatGateway } = makeController();
      const conversation = {
        id: 10,
        status: ConversationStatus.CLOSED,
      };
      chatService.closeConversation.mockResolvedValue(conversation);

      await expect(controller.closeConversation('10')).resolves.toBe(
        conversation,
      );

      expect(chatGateway.notifyConversationClosed).toHaveBeenCalledWith([10]);
    });
  });
});
