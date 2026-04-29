import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import {
  Conversation,
  ConversationStatus,
  ConversationType,
} from './entities/conversation.entity';
import { ChatMessage, SenderRole } from './entities/chat-message.entity';
import { OpenRouterService } from './openrouter.service';
import { CreateConversationDto } from './dto/create-conversation.dto';

@Injectable()
export class ChatService {
  private readonly SYSTEM_PROMPT =
    'You are GridBot, a helpful assistant for GRID printing services. ' +
    'Help customers with questions about paper printing, 3D printing, ' +
    'pricing, and delivery. For order-specific issues or account matters, ' +
    'politely direct them to our admin support team.';

  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ChatMessage)
    private readonly msgRepo: Repository<ChatMessage>,
    private readonly openRouter: OpenRouterService,
  ) {}

  async createConversation(
    customerId: number,
    dto: CreateConversationDto,
  ): Promise<Conversation> {
    const conv = this.convRepo.create({
      customerId,
      type: dto.type,
      orderId: dto.orderId ?? null,
      assignedRiderId:
        dto.type === ConversationType.RIDER
          ? (dto.assignedRiderId ?? null)
          : null,
      status: ConversationStatus.OPEN,
    });
    return this.convRepo.save(conv);
  }

  async getConversations(customerId: number): Promise<Conversation[]> {
    return this.convRepo.find({
      where: { customerId },
      order: { updatedAt: 'DESC' },
    });
  }

  async getMessages(
    conversationId: number,
    page = 1,
    limit = 50,
  ): Promise<ChatMessage[]> {
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findConversation(id: number): Promise<Conversation | null> {
    return this.convRepo.findOne({ where: { id } });
  }

  async saveMessage(
    conversationId: number,
    senderId: number | null,
    senderRole: SenderRole,
    content: string | null,
    attachmentFileId?: number | null,
    attachmentMimeType?: string | null,
  ): Promise<ChatMessage> {
    const msg = this.msgRepo.create({
      conversationId,
      senderId,
      senderRole,
      content: content && content.length > 0 ? content : null,
      attachmentFileId: attachmentFileId ?? null,
      attachmentMimeType: attachmentMimeType ?? null,
    });
    const saved = await this.msgRepo.save(msg);
    await this.convRepo.update(conversationId, { updatedAt: new Date() });
    return saved;
  }

  async getUnreadCount(customerId: number): Promise<number> {
    return this.msgRepo
      .createQueryBuilder('m')
      .innerJoin('chat_conversations', 'c', 'c.id = m.conversation_id')
      .where('c.customer_id = :customerId', { customerId })
      .andWhere('m.sender_role <> :role', { role: SenderRole.CUSTOMER })
      .andWhere('m.is_read = false')
      .getCount();
  }

  async getBotResponse(
    conversationId: number,
    userMessage: string,
  ): Promise<string> {
    // Called after the user's message is persisted — history already includes it
    const history = await this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    const messages = [
      { role: 'system', content: this.SYSTEM_PROMPT },
      ...history
        .reverse()
        .filter((m) => m.content && m.content.length > 0)
        .map((m) => ({
          role: m.senderRole === SenderRole.BOT ? 'assistant' : 'user',
          content: m.content as string,
        })),
    ];

    return this.openRouter.complete(messages);
  }

  async getAdminConversations(
    status?: string,
    type?: string,
  ): Promise<Conversation[]> {
    const where: FindOptionsWhere<Conversation> = {};
    if (
      status &&
      Object.values(ConversationStatus).includes(status as ConversationStatus)
    ) {
      where.status = status as ConversationStatus;
    }
    if (
      type &&
      Object.values(ConversationType).includes(type as ConversationType)
    ) {
      where.type = type as ConversationType;
    }
    return this.convRepo.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['customer'],
    });
  }

  async assignAdmin(
    conversationId: number,
    adminId: number,
  ): Promise<Conversation> {
    await this.convRepo.update(conversationId, {
      assignedAdminId: adminId,
      status: ConversationStatus.ASSIGNED,
    });
    return this.convRepo.findOneOrFail({
      where: { id: conversationId },
      relations: ['customer'],
    });
  }

  async closeConversation(conversationId: number): Promise<Conversation> {
    await this.convRepo.update(conversationId, {
      status: ConversationStatus.CLOSED,
      closedAt: new Date(),
    });
    return this.convRepo.findOneOrFail({
      where: { id: conversationId },
      relations: ['customer'],
    });
  }

  async markMessagesRead(conversationId: number): Promise<void> {
    await this.msgRepo.update(
      { conversationId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }
}
