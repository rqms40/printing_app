import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  Not,
  Repository,
} from 'typeorm';
import {
  Conversation,
  ConversationStatus,
  ConversationType,
} from './entities/conversation.entity';
import { ChatMessage, SenderRole } from './entities/chat-message.entity';
import { OpenRouterService } from './openrouter.service';
import { GRIDBOT_SYSTEM_PROMPT } from './gridbot.prompt';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { Order } from '../orders/entities/order.entity';

export type ChatActorRole = 'admin' | 'customer' | 'rider';

@Injectable()
export class ChatService {
  private readonly SYSTEM_PROMPT = GRIDBOT_SYSTEM_PROMPT;

  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ChatMessage)
    private readonly msgRepo: Repository<ChatMessage>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly openRouter: OpenRouterService,
  ) {}

  async createConversation(
    customerId: number,
    dto: CreateConversationDto,
  ): Promise<Conversation> {
    if (dto.orderId != null && dto.type !== ConversationType.AI) {
      return this.getOrCreateCustomerOrderConversation(
        customerId,
        dto.orderId,
        dto.type,
      );
    }

    const conv = this.convRepo.create({
      customerId,
      type: dto.type,
      orderId: dto.orderId ?? null,
      assignedRiderId: null,
      status: ConversationStatus.OPEN,
    });
    return this.convRepo.save(conv);
  }

  async getOrCreateCustomerOrderConversation(
    customerId: number,
    orderRef: string | number,
    requestedType?: ConversationType,
  ): Promise<Conversation> {
    const candidate = await this.findOrderByRef(orderRef);
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, candidate.id);
      if (order.userId !== customerId) {
        throw new ForbiddenException('You can only chat about your own orders');
      }

      const type =
        requestedType ??
        (order.assignedRiderId
          ? ConversationType.RIDER
          : ConversationType.ADMIN);

      if (type === ConversationType.RIDER && !order.assignedRiderId) {
        throw new BadRequestException('No rider is assigned to this order yet');
      }

      return this.getOrCreateOrderConversation(
        manager.getRepository(Conversation),
        {
          customerId: order.userId,
          orderId: order.id,
          type,
          assignedRiderId:
            type === ConversationType.RIDER ? order.assignedRiderId : null,
        },
      );
    });
  }

  async getOrCreateRiderOrderConversation(
    riderUserId: number,
    orderRef: string | number,
  ): Promise<Conversation> {
    const candidate = await this.findOrderByRef(orderRef);
    return this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, candidate.id);
      if (order.assignedRiderId !== riderUserId) {
        throw new ForbiddenException(
          'Only the assigned rider can chat about this order',
        );
      }

      return this.getOrCreateOrderConversation(
        manager.getRepository(Conversation),
        {
          customerId: order.userId,
          orderId: order.id,
          type: ConversationType.RIDER,
          assignedRiderId: riderUserId,
        },
      );
    });
  }

  async getOrCreateDirectConversation(userId: number): Promise<Conversation> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(Conversation);
      const existing = await repo.findOne({
        where: {
          customerId: userId,
          type: ConversationType.ADMIN,
          status: Not(ConversationStatus.CLOSED),
        },
        order: { updatedAt: 'DESC' },
      });
      if (existing) return existing;

      const conv = repo.create({
        customerId: userId,
        type: ConversationType.ADMIN,
        orderId: null,
        assignedRiderId: null,
        status: ConversationStatus.OPEN,
      });
      return repo.save(conv);
    });
  }

  private async lockOrder(
    manager: EntityManager,
    orderId: number,
  ): Promise<Order> {
    const order = await manager.getRepository(Order).findOne({
      where: { id: orderId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async findOrderByRef(orderRef: string | number): Promise<Order> {
    const ref = String(orderRef).trim();
    const numericId = Number(ref);
    const where: FindOptionsWhere<Order>[] = [];
    if (Number.isInteger(numericId) && numericId > 0) {
      where.push({ id: numericId });
    }
    where.push({ orderId: ref });

    const order = await this.orderRepo.findOne({ where });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private async getOrCreateOrderConversation(
    conversationRepo: Repository<Conversation>,
    {
      customerId,
      orderId,
      type,
      assignedRiderId,
    }: {
      customerId: number;
      orderId: number;
      type: ConversationType;
      assignedRiderId: number | null;
    },
  ): Promise<Conversation> {
    const where: FindOptionsWhere<Conversation> = {
      customerId,
      orderId,
      type,
      status: Not(ConversationStatus.CLOSED),
    };
    if (type === ConversationType.RIDER) {
      if (assignedRiderId == null) {
        throw new BadRequestException('No rider is assigned to this order yet');
      }
      where.assignedRiderId = assignedRiderId;
    }

    const existing = await conversationRepo.findOne({
      where,
      order: { updatedAt: 'DESC' },
    });
    if (existing) return existing;

    const conv = conversationRepo.create({
      customerId,
      type,
      orderId,
      assignedRiderId,
      status: ConversationStatus.OPEN,
    });
    return conversationRepo.save(conv);
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

  async getMessagesForActor(
    conversationId: number,
    userId: number,
    role: ChatActorRole,
    page = 1,
    limit = 50,
  ): Promise<ChatMessage[]> {
    return this.withAuthorizedConversation(
      conversationId,
      userId,
      role,
      false,
      (manager) =>
        manager.getRepository(ChatMessage).find({
          where: { conversationId },
          order: { createdAt: 'ASC' },
          skip: (page - 1) * limit,
          take: limit,
        }),
    );
  }

  async assertCanAccessConversationForActor(
    conversationId: number,
    userId: number,
    role: ChatActorRole,
  ): Promise<Conversation> {
    return this.withAuthorizedConversation(
      conversationId,
      userId,
      role,
      true,
      (_manager, conversation) => conversation,
    );
  }

  async saveMessageForActor(
    conversationId: number,
    userId: number,
    role: ChatActorRole,
    content: string | null,
    attachmentFileId?: number | null,
    attachmentMimeType?: string | null,
  ): Promise<ChatMessage> {
    const senderRole =
      role === 'admin'
        ? SenderRole.ADMIN
        : role === 'rider'
          ? SenderRole.RIDER
          : SenderRole.CUSTOMER;
    return this.withAuthorizedConversation(
      conversationId,
      userId,
      role,
      true,
      (manager) =>
        this.saveMessageInTransaction(
          manager,
          conversationId,
          userId,
          senderRole,
          content,
          attachmentFileId,
          attachmentMimeType,
        ),
    );
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
    return this.dataSource.transaction(async (manager) => {
      const conversation = await manager.getRepository(Conversation).findOne({
        where: { id: conversationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }
      if (conversation.status === ConversationStatus.CLOSED) {
        throw new BadRequestException('Conversation is closed');
      }
      return this.saveMessageInTransaction(
        manager,
        conversationId,
        senderId,
        senderRole,
        content,
        attachmentFileId,
        attachmentMimeType,
      );
    });
  }

  private async saveMessageInTransaction(
    manager: EntityManager,
    conversationId: number,
    senderId: number | null,
    senderRole: SenderRole,
    content: string | null,
    attachmentFileId?: number | null,
    attachmentMimeType?: string | null,
  ): Promise<ChatMessage> {
    const messageRepo = manager.getRepository(ChatMessage);
    const conversationRepo = manager.getRepository(Conversation);
    const msg = messageRepo.create({
      conversationId,
      senderId,
      senderRole,
      content: content && content.length > 0 ? content : null,
      attachmentFileId: attachmentFileId ?? null,
      attachmentMimeType: attachmentMimeType ?? null,
    });
    const saved = await messageRepo.save(msg);
    await conversationRepo.update(conversationId, { updatedAt: new Date() });
    return saved;
  }

  private async withAuthorizedConversation<T>(
    conversationId: number,
    userId: number,
    role: ChatActorRole,
    requireOpen: boolean,
    action: (
      manager: EntityManager,
      conversation: Conversation,
    ) => Promise<T> | T,
  ): Promise<T> {
    const candidate = await this.convRepo.findOne({
      where: { id: conversationId },
    });
    if (!candidate) throw new NotFoundException('Conversation not found');

    return this.dataSource.transaction(async (manager) => {
      let order: Order | null = null;
      if (
        candidate.type === ConversationType.RIDER &&
        candidate.orderId != null
      ) {
        order = await manager.getRepository(Order).findOne({
          where: { id: candidate.orderId },
          lock: { mode: 'pessimistic_write' },
        });
      }

      const conversation = await manager.getRepository(Conversation).findOne({
        where: { id: conversationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!conversation) {
        throw new NotFoundException('Conversation not found');
      }

      const canAccess =
        (!requireOpen || conversation.status !== ConversationStatus.CLOSED) &&
        (role === 'admin' ||
          (role === 'customer' && conversation.customerId === userId) ||
          (role === 'rider' &&
            conversation.type === ConversationType.RIDER &&
            conversation.status !== ConversationStatus.CLOSED &&
            conversation.assignedRiderId === userId &&
            conversation.orderId === candidate.orderId &&
            order?.assignedRiderId === userId));
      if (!canAccess) throw new ForbiddenException('Forbidden');

      return action(manager, conversation);
    });
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
    _userMessage: string,
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

  async markMessagesReadForActor(
    conversationId: number,
    userId: number,
    role: ChatActorRole,
  ): Promise<void> {
    await this.withAuthorizedConversation(
      conversationId,
      userId,
      role,
      true,
      async (manager) => {
        await manager
          .getRepository(ChatMessage)
          .update(
            { conversationId, isRead: false },
            { isRead: true, readAt: new Date() },
          );
      },
    );
  }
}
