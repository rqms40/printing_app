import { ForbiddenException } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ConversationType } from './entities/conversation.entity';
import type { ChatGateway } from './chat.gateway';
import type { ChatService } from './chat.service';
import type { UsersService } from '../users/users.service';

const makeController = () => {
  const chatService = {
    createConversation: jest.fn(),
    getOrCreateCustomerOrderConversation: jest.fn(),
    getOrCreateDriverOrderConversation: jest.fn(),
    findConversation: jest.fn(),
    getMessages: jest.fn(),
    getConversations: jest.fn(),
    getAdminConversations: jest.fn(),
    assignAdmin: jest.fn(),
    closeConversation: jest.fn(),
  };
  const chatGateway = {
    notifyNewConversation: jest.fn(),
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
          user: { sub: 5, role: 'customer', email: 'customer@example.com' },
        }),
      ).resolves.toBe(conversation);
      expect(
        chatService.getOrCreateCustomerOrderConversation,
      ).toHaveBeenCalledWith(5, '42');
    });

    it('uses the driver order conversation flow for drivers', async () => {
      const { controller, chatService } = makeController();
      const conversation = {
        id: 8,
        customerId: 5,
        type: ConversationType.RIDER,
        orderId: 42,
        assignedRiderId: 12,
      };
      chatService.getOrCreateDriverOrderConversation.mockResolvedValue(
        conversation,
      );

      await expect(
        controller.openOrderConversation('42', {
          user: { sub: 12, role: 'driver', email: 'driver@example.com' },
        }),
      ).resolves.toBe(conversation);
      expect(
        chatService.getOrCreateDriverOrderConversation,
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
          senderRole: 'customer',
          content: 'Where are you?',
        },
      ];
      chatService.findConversation.mockResolvedValue({
        id: 10,
        customerId: 5,
        type: ConversationType.RIDER,
        assignedRiderId: 12,
      });
      chatService.getMessages.mockResolvedValue(messages);

      await expect(
        controller.getMessages('10', '1', '50', {
          user: { sub: 12, role: 'driver', email: 'rider@example.com' },
        }),
      ).resolves.toBe(messages);
      expect(chatService.getMessages).toHaveBeenCalledWith(10, 1, 50);
    });

    it('rejects an unrelated rider from loading conversation history', async () => {
      const { controller, chatService } = makeController();
      chatService.findConversation.mockResolvedValue({
        id: 10,
        customerId: 5,
        type: ConversationType.RIDER,
        assignedRiderId: 12,
      });

      await expect(
        controller.getMessages('10', '1', '50', {
          user: { sub: 99, role: 'driver', email: 'other@example.com' },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(chatService.getMessages).not.toHaveBeenCalled();
    });

    it('rejects matching assignedRiderId when the requester is not a driver', async () => {
      const { controller, chatService } = makeController();
      chatService.findConversation.mockResolvedValue({
        id: 10,
        customerId: 5,
        type: ConversationType.RIDER,
        assignedRiderId: 12,
      });

      await expect(
        controller.getMessages('10', '1', '50', {
          user: { sub: 12, role: 'customer', email: 'not-driver@example.com' },
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(chatService.getMessages).not.toHaveBeenCalled();
    });
  });
});
