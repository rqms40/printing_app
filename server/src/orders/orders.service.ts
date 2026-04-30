import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, MoreThanOrEqual, Repository } from 'typeorm';
import {
  BETA_ORDER_LIMIT_MESSAGE,
  BETA_ORDER_LIMIT_REACHED,
} from './dto/beta-order-limit.error';
import { Order, OrderStatus } from './entities/order.entity';
import { BatchOrder } from './entities/batch-order.entity';
import { OrderItem } from './entities/order-item.entity';
import { PaperSpec } from './entities/paper-specs.entity';
import { ThreeDSpec } from './entities/three-d-specs.entity';
import { DeliveryDestination } from './entities/delivery-destination.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from '../drivers/entities/delivery-assignment.entity';
import { OrdersGateway } from './orders.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { CreditsService } from '../credits/credits.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { CreateBatchOrderDto } from './dto/create-order.dto';
import { DeliverySpeedTier } from './enums/delivery-speed-tier.enum';
import { UpdateManualStatusDto } from './dto/update-manual-status.dto';
import { Address } from '../addresses/entities/address.entity';
import { DeliverySlotsService } from '../delivery-slots/delivery-slots.service';
import { DeliverySettingsService } from '../delivery-slots/delivery-settings.service';
import { DeliverySlotsGateway } from '../delivery-slots/delivery-slots.gateway';
import { PrinterProfileService } from '../printer-profile/printer-profile.service';
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemsRepo: Repository<OrderItem>,
    @InjectRepository(PaperSpec) private paperSpecsRepo: Repository<PaperSpec>,
    @InjectRepository(ThreeDSpec)
    private threeDSpecsRepo: Repository<ThreeDSpec>,
    @InjectRepository(DeliveryAssignment)
    private deliveryAssignmentRepo: Repository<DeliveryAssignment>,
    @InjectRepository(Address)
    private addressRepo: Repository<Address>,
    @InjectRepository(DeliveryDestination)
    private deliveryDestinationRepo: Repository<DeliveryDestination>,
    @InjectRepository(BatchOrder) private batchOrdersRepo: Repository<BatchOrder>,
    private ordersGateway: OrdersGateway,
    private firebaseService: FirebaseService,
    private usersService: UsersService,
    private creditsService: CreditsService,
    private notificationsService: NotificationsService,
    private filesService: FilesService,
    private tamSurveysService: TamSurveysService,
    private dataSource: DataSource,
    private slotsService: DeliverySlotsService,
    private settingsService: DeliverySettingsService,
    private slotsGateway: DeliverySlotsGateway,
    private printerProfileService: PrinterProfileService,
    @InjectRepository(FileMetadata)
    private readonly fileMetadataRepo: Repository<FileMetadata>,
  ) {}

  async findByUser(userId: number): Promise<Order[]> {
    const orders = await this.ordersRepo.find({
      where: { userId },
      relations: ['batchOrder', 'items', 'items.paperSpec', 'items.threeDSpec'],
      order: { createdAt: 'DESC' },
    });
    return this.attachDeliveryAssignmentIds(orders);
  }

  async findById(id: number): Promise<Order | null> {
    const order = await this.ordersRepo.findOne({
      where: { id },
      relations: ['batchOrder', 'items', 'items.paperSpec', 'items.threeDSpec'],
    });
    if (!order) return null;
    const [withTracking] = await this.attachDeliveryAssignmentIds([order]);
    return withTracking;
  }

  private async attachDeliveryAssignmentIds(orders: Order[]): Promise<Order[]> {
    const orderIds = orders.map((order) => order.id).filter(Boolean);
    if (orderIds.length === 0) return orders;

    const assignments = await this.deliveryAssignmentRepo.find({
      where: {
        orderId: In(orderIds),
        status: In([
          DeliveryStatus.ASSIGNED,
          DeliveryStatus.ACCEPTED,
          DeliveryStatus.PICKED_UP,
          DeliveryStatus.ON_THE_WAY,
          DeliveryStatus.ARRIVED,
        ]),
      },
    });

    const assignmentByOrderId = new Map<number, DeliveryAssignment>();
    for (const assignment of assignments) {
      if (!assignmentByOrderId.has(assignment.orderId)) {
        assignmentByOrderId.set(assignment.orderId, assignment);
      }
    }

    return orders.map((order) =>
      Object.assign(order, {
        deliveryAssignmentId: assignmentByOrderId.get(order.id)?.id ?? null,
      }),
    );
  }

  async assertBetaOrderLimit(userId: number): Promise<void> {
    const user = await this.usersService.findById(userId);
    if (!user?.isBetaUser || !user.betaEnrolledAt) return;

    const count = await this.ordersRepo.count({
      where: {
        userId,
        createdAt: MoreThanOrEqual(user.betaEnrolledAt),
      },
    });
    if (count >= 1) {
      throw new ForbiddenException({
        code: BETA_ORDER_LIMIT_REACHED,
        message: BETA_ORDER_LIMIT_MESSAGE,
      });
    }
  }

  async create(
    data: Partial<Order> & {
      paperSpecs?: Partial<PaperSpec>;
      threeDSpecs?: Partial<ThreeDSpec>;
    },
  ): Promise<Order> {
    if (data.userId != null) {
      await this.assertBetaOrderLimit(Number(data.userId));
    }
    const { paperSpecs, threeDSpecs, ...orderData } = data;
    if (orderData.deliveryAddressId != null && orderData.userId != null) {
      orderData.deliveryAddressId = await this.validateDeliveryAddress(
        Number(orderData.deliveryAddressId),
        Number(orderData.userId),
      );
    }

    // Validate and deduct credits if payment method is credits
    if (
      OrdersService.isCreditPaymentMethod(orderData.paymentMethod) &&
      Number(orderData.totalPrice ?? 0) + Number(orderData.deliveryFee ?? 0) > 0
    ) {
      if (!orderData.userId) {
        throw new Error('User ID is required to process credit payment');
      }

      const userId = orderData.userId;
      const amountCredits =
        Number(orderData.totalPrice ?? 0) + Number(orderData.deliveryFee ?? 0);

      // Attempt subtraction, will throw BadRequestException if insufficient
      await this.creditsService.subtractCredits(
        userId,
        amountCredits,
        'order_placed',
      );
    }

    const count = await this.ordersRepo.count();
    const orderId = `ORD-${(10001 + count).toString().padStart(5, '0')}`;
    const order = this.ordersRepo.create({ ...orderData, orderId });
    const savedOrder = await this.ordersRepo.save(order);
    const savedItem = await this.orderItemsRepo.save(
      this.orderItemsRepo.create({
        orderId: savedOrder.id,
        category: savedOrder.category,
        quantity: savedOrder.quantity,
        totalPrice: savedOrder.totalPrice,
        fileName: savedOrder.fileName,
        fileUrl: savedOrder.fileUrl,
        fileMetadataId: savedOrder.fileMetadataId,
      }),
    );

    if (paperSpecs) {
      const spec = this.paperSpecsRepo.create({
        orderId: savedOrder.id,
        orderItemId: savedItem.id,
        ...paperSpecs,
      });
      await this.paperSpecsRepo.save(spec);
    }
    if (threeDSpecs) {
      const spec = this.threeDSpecsRepo.create({
        orderId: savedOrder.id,
        orderItemId: savedItem.id,
        ...threeDSpecs,
      });
      await this.threeDSpecsRepo.save(spec);
    }

    await this.notifyOrderPlaced(savedOrder);

    return savedOrder;
  }

  async createBatch(
    userId: number,
    dto: CreateBatchOrderDto,
  ): Promise<{ batchId: string; orders: Order[] }> {
    await this.assertBetaOrderLimit(userId);
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Batch order requires at least one item');
    }

    const normalizedItems = dto.items.map((item) => ({
      ...item,
      quantity: Number(item.quantity ?? 1),
      totalPrice: Number(item.totalPrice ?? 0),
      fileMetadataId:
        item.fileMetadataId == null ? undefined : Number(item.fileMetadataId),
      threeDSpecs: item.threeDSpecs
        ? {
            ...item.threeDSpecs,
            infillPercentage: Number(item.threeDSpecs.infillPercentage ?? 20),
            layerHeight: Number(item.threeDSpecs.layerHeight ?? 0.2),
          }
        : undefined,
    }));

    const subtotal = normalizedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );
    const deliveryFee = Number(dto.deliveryFee ?? 0);
    const deliveryAddressId =
      dto.deliveryAddressId == null ? undefined : Number(dto.deliveryAddressId);
    const validatedDeliveryAddressId =
      deliveryAddressId == null
        ? undefined
        : await this.validateDeliveryAddress(deliveryAddressId, userId);

    // --- Destination resolution ---
    const destinations = dto.destinations ?? [];
    let deliveryType: 'local' | 'external' = 'local';

    for (const dest of destinations) {
      const addr = await this.addressRepo.findOne({ where: { id: dest.addressId } });
      const inside = await this.settingsService.isInsideServiceArea(
        addr ? Number(addr.latitude) : null,
        addr ? Number(addr.longitude) : null,
      );
      if (!inside) {
        deliveryType = 'external';
        break;
      }
    }

    // --- Fee computation ---
    const settings = await this.settingsService.getSettings();
    const speedTier = dto.speedTier ?? DeliverySpeedTier.STANDARD;
    const isPriority = speedTier === DeliverySpeedTier.PRIORITY;
    const priorityFee = isPriority ? Number(settings.priorityFeeAmount) : 0;
    const extraDestCount = Math.max(0, destinations.length - 1);
    const extraDestinationFee = extraDestCount * Number(settings.extraDestinationSurcharge);
    const totalPrice = subtotal + deliveryFee + priorityFee + extraDestinationFee;

    // --- 3D bounds enforcement ---
    const profile = await this.printerProfileService.getProfile();
    for (const item of normalizedItems) {
      if (item.category !== '3d') continue;
      if (item.fileMetadataId == null) continue;
      const meta = await this.fileMetadataRepo.findOneOrFail({
        where: { id: item.fileMetadataId },
      });
      if (meta.model3dWidthMm == null) continue;
      const w = Number(meta.model3dWidthMm);
      const d = Number(meta.model3dDepthMm);
      const h = Number(meta.model3dHeightMm);
      if (
        w > profile.buildVolumeWidthMm ||
        d > profile.buildVolumeDepthMm ||
        h > profile.buildVolumeHeightMm
      ) {
        throw new BadRequestException({
          message: `Model exceeds printer build volume (${w}×${d}×${h}mm vs ${profile.buildVolumeWidthMm}×${profile.buildVolumeDepthMm}×${profile.buildVolumeHeightMm}mm)`,
          code: 'model_exceeds_build_volume',
        });
      }
    }

    // --- Standard/Express delivery requires a bookable slot today ---
    // Both implicitly happen "today". If today has no slot still open
    // for booking (all full or all already ended), reject with a clear
    // code so the client can prompt the user to pick Pickup or Schedule.
    const isImmediateTier =
      speedTier === DeliverySpeedTier.STANDARD ||
      speedTier === DeliverySpeedTier.PRIORITY;
    if (
      dto.deliveryOption === 'delivery' &&
      deliveryType === 'local' &&
      isImmediateTier &&
      dto.slotTemplateId == null
    ) {
      const today = new Date().toISOString().slice(0, 10);
      const todaySlots = await this.slotsService.getAvailability(today);
      const now = new Date();
      // A slot is usable for an immediate (Standard/Express) drop only if it
      // is live RIGHT NOW: start ≤ now < end, AND not full. A slot starting
      // hours from now (e.g. 9:30 AM seen at 1 AM) doesn't count.
      const hasBookable = todaySlots.some((s) => {
        if (s.isFull) return false;
        const [eh, em] = s.endTime.split(':').map(Number);
        const [sh, sm] = s.startTime.split(':').map(Number);
        const end = new Date(now);
        end.setHours(eh, em, 0, 0);
        const start = new Date(now);
        start.setHours(sh, sm, 0, 0);
        return start.getTime() <= now.getTime() && end.getTime() > now.getTime();
      });
      if (!hasBookable) {
        throw new BadRequestException({
          code: 'no_slot_available_today',
          message:
            'No delivery slot is available right now. Please choose Pickup or Schedule a future slot.',
        });
      }
    }

    const orders = await this.dataSource.transaction(async (manager) => {
      const batchOrdersRepo = manager.getRepository(BatchOrder);
      const txOrdersRepo = manager.getRepository(Order);
      const txOrderItemsRepo = manager.getRepository(OrderItem);
      const txPaperSpecsRepo = manager.getRepository(PaperSpec);
      const txThreeDSpecsRepo = manager.getRepository(ThreeDSpec);
      const txDestinationRepo = manager.getRepository(DeliveryDestination);

      const batchCount = await batchOrdersRepo.count();
      const batchRef = `BATCH-${(10001 + batchCount).toString().padStart(5, '0')}`;
      const batch = batchOrdersRepo.create({
        batchRef,
        userId,
        subtotal,
        deliveryFee,
        totalPrice,
        paymentMethod: dto.paymentMethod,
        paymentStatus: dto.paymentStatus ?? 'pending',
        deliveryOption: dto.deliveryOption,
        deliveryAddressId: validatedDeliveryAddressId,
      });
      const savedBatch = await batchOrdersRepo.save(batch);

      // --- Persist new fields on batch ---
      savedBatch.deliveryType = deliveryType;
      savedBatch.priorityFee = priorityFee;
      savedBatch.speedTier = speedTier;
      savedBatch.extraDestinationFee = extraDestinationFee;
      savedBatch.externalDeliveryStatus =
        deliveryType === 'external' ? 'pending_admin' : null;
      savedBatch.slotBookingId = null;
      await batchOrdersRepo.save(savedBatch);

      // --- Insert DeliveryDestination rows ---
      const savedDestinations: DeliveryDestination[] = [];
      for (let i = 0; i < destinations.length; i++) {
        const dest = destinations[i];
        const destEntity = txDestinationRepo.create({
          batchOrderId: savedBatch.id,
          addressId: dest.addressId,
          label: dest.label ?? null,
          sortOrder: i,
        });
        const savedDest = await txDestinationRepo.save(destEntity);
        savedDestinations.push(savedDest);
      }

      // --- Book slot if local ---
      if (
        deliveryType === 'local' &&
        dto.slotTemplateId != null &&
        dto.slotDate != null
      ) {
        const booking = await this.slotsService.bookSlot(manager, {
          slotTemplateId: dto.slotTemplateId,
          date: dto.slotDate,
          batchOrderId: savedBatch.id,
          priority: isPriority,
        });
        savedBatch.slotBookingId = booking.id;
        await batchOrdersRepo.save(savedBatch);
      }

      const orderCount = await txOrdersRepo.count();
      const orderId = `ORD-${(10001 + orderCount).toString().padStart(5, '0')}`;
      const firstItem = normalizedItems[0];
      // For the aggregate order, wire it to the first item's destination (if any)
      const firstDestId = savedDestinations[normalizedItems[0]?.destinationIndex ?? 0]?.id ?? null;
      const aggregateOrder = txOrdersRepo.create({
        userId,
        orderId,
        category: normalizedItems.length > 1 ? 'batch' : firstItem.category,
        quantity: normalizedItems.reduce((sum, item) => sum + item.quantity, 0),
        totalPrice: subtotal,
        deliveryFee,
        paymentMethod: dto.paymentMethod,
        paymentStatus: dto.paymentStatus ?? 'pending',
        deliveryOption: dto.deliveryOption,
        deliveryAddressId: validatedDeliveryAddressId,
        fileName:
          normalizedItems.length > 1
            ? `${normalizedItems.length} print jobs`
            : firstItem.fileName,
        fileUrl: normalizedItems.length === 1 ? firstItem.fileUrl : undefined,
        fileMetadataId:
          normalizedItems.length === 1
            ? (firstItem.fileMetadataId ?? null)
            : null,
        batchOrderId: savedBatch.id,
        destinationId: firstDestId,
      } as Partial<Order>);
      const savedOrder = await txOrdersRepo.save(aggregateOrder);

      for (const item of normalizedItems) {
        const savedItem = await txOrderItemsRepo.save(
          txOrderItemsRepo.create({
            orderId: savedOrder.id,
            category: item.category,
            quantity: item.quantity,
            totalPrice: item.totalPrice,
            fileName: item.fileName,
            fileUrl: item.fileUrl,
            fileMetadataId: item.fileMetadataId,
          }),
        );
        if (item.paperSpecs) {
          const spec = txPaperSpecsRepo.create({
            orderItemId: savedItem.id,
            ...item.paperSpecs,
          });
          await txPaperSpecsRepo.save(spec);
        }
        if (item.threeDSpecs) {
          const spec = txThreeDSpecsRepo.create({
            orderId: savedOrder.id,
            orderItemId: savedItem.id,
            ...item.threeDSpecs,
          });
          await txThreeDSpecsRepo.save(spec);
        }
      }

      if (
        OrdersService.isCreditPaymentMethod(dto.paymentMethod) &&
        totalPrice > 0
      ) {
        await this.creditsService.subtractCredits(
          userId,
          totalPrice,
          'order_placed',
        );
      }

      const orderWithItems = await txOrdersRepo.findOneOrFail({
        where: { id: savedOrder.id },
        relations: [
          'batchOrder',
          'items',
          'items.paperSpec',
          'items.threeDSpec',
        ],
      });

      return { batchRef: savedBatch.batchRef, orders: [orderWithItems] };
    });

    // --- After transaction: emit WS event if local ---
    if (deliveryType === 'local' && dto.slotDate != null && dto.slotTemplateId != null) {
      const counts = await this.slotsService.getAvailability(dto.slotDate);
      const updated = counts.find((c) => c.templateId === dto.slotTemplateId);
      if (updated) {
        this.slotsGateway.notifySlotUpdated({
          templateId: updated.templateId,
          date: dto.slotDate,
          bookedCount: updated.bookedCount,
        });
      }
    }

    for (const order of orders.orders) {
      await this.notifyOrderPlaced(order);
    }

    return { batchId: orders.batchRef, orders: orders.orders };
  }

  private async notifyOrderPlaced(savedOrder: Order): Promise<void> {
    // Notify via WebSocket — admin queue sees new orders in real-time
    void this.ordersGateway.notifyOrderUpdate(savedOrder.orderId, savedOrder);

    // Notify admins of new order
    try {
      await this.notificationsService.createForAllAdmins({
        title: 'New Order Placed',
        message: `Order ${savedOrder.orderId} has been placed.`,
        type: 'order_placed',
        orderRef: savedOrder.orderId,
        metadata: {
          orderId: savedOrder.id,
          amount: Number(savedOrder.totalPrice ?? 0),
          category: savedOrder.category ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Admin notification failed for order ${savedOrder.orderId}: ${err}`,
      );
    }
  }

  private static readonly CANCELLABLE_STATUSES: OrderStatus[] = [
    OrderStatus.ORDER_PLACED,
    OrderStatus.FILE_VERIFIED,
  ];

  private static isCreditPaymentMethod(paymentMethod?: string): boolean {
    const normalized = paymentMethod?.replace(/[_-]/g, '').toLowerCase();
    return normalized === 'credits' || normalized === 'gridcredits';
  }

  private async validateDeliveryAddress(
    deliveryAddressId: number,
    userId: number,
  ): Promise<number> {
    if (!Number.isInteger(deliveryAddressId) || deliveryAddressId <= 0) {
      throw new BadRequestException('Invalid delivery address');
    }

    const address = await this.addressRepo.findOne({
      where: { id: deliveryAddressId, userId },
    });

    if (!address) {
      throw new BadRequestException('Invalid delivery address');
    }

    return deliveryAddressId;
  }

  async listExternalDeliveries(status?: string) {
    return this.batchOrdersRepo.find({
      where: {
        deliveryType: 'external',
        ...(status ? { externalDeliveryStatus: status as any } : {}),
      },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async updateManualStatus(
    orderId: number,
    dto: UpdateManualStatusDto,
  ): Promise<Order> {
    const order = await this.ordersRepo.findOneOrFail({
      where: { id: orderId },
    });
    const wasFirstSet = order.adminStatusSetAt === null && dto.note !== null;
    order.adminStatusNote = dto.note;
    order.estimatedCompletionAt = dto.estimatedCompletionAt
      ? new Date(dto.estimatedCompletionAt)
      : null;
    if (dto.note !== null && order.adminStatusSetAt === null) {
      order.adminStatusSetAt = new Date();
    }
    const saved = await this.ordersRepo.save(order);

    if (wasFirstSet) {
      try {
        await this.notificationsService.create({
          userId: order.userId,
          title: `Order #ORD-${order.id} update`,
          body: dto.note ?? '',
          message: dto.note ?? '',
          type: 'order_admin_status',
          orderRef: order.orderId,
          metadata: { orderId: order.id },
        } as any);
      } catch (err) {
        this.logger.warn(
          `Manual status notification failed for order ${orderId}: ${err}`,
        );
      }
    }

    return saved;
  }

  async updateExternalDeliveryStatus(
    id: number,
    status: 'pending_admin' | 'booked' | 'delivered',
  ): Promise<void> {
    await this.batchOrdersRepo.update(id, { externalDeliveryStatus: status });
  }

  async cancelBatch(batchOrderId: number, userId: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const batch = await manager.findOneOrFail(BatchOrder, {
        where: { id: batchOrderId, userId },
      });
      if (batch.slotBookingId) {
        await this.slotsService.releaseSlot(manager, batch.slotBookingId);
        batch.slotBookingId = null;
        await manager.save(batch);
      }
      await manager.update(
        Order,
        { batchOrderId: batch.id },
        { orderStatus: 'cancelled' as any },
      );
    });
  }

  async cancelOrder(id: number, userId: number): Promise<Order> {
    const order = await this.ordersRepo.findOneOrFail({
      where: { id },
      relations: ['batchOrder', 'items', 'items.paperSpec', 'items.threeDSpec'],
    });
    if (order.userId !== userId) {
      throw new Error('Forbidden');
    }
    if (!OrdersService.CANCELLABLE_STATUSES.includes(order.orderStatus)) {
      throw new Error('Order cannot be cancelled at this stage');
    }

    if (
      OrdersService.isCreditPaymentMethod(order.paymentMethod) &&
      Number(order.totalPrice) + Number(order.deliveryFee ?? 0) > 0
    ) {
      const refundAmount =
        Number(order.totalPrice) + Number(order.deliveryFee ?? 0);
      await this.creditsService.refundCredits(
        order.userId,
        refundAmount,
        order.orderId,
      );
      return this.updateStatus(id, 'cancelled', { paymentStatus: 'refunded' });
    }

    return this.updateStatus(id, 'cancelled');
  }

  async updateStatus(
    id: number,
    status: string,
    updates: Partial<Order> = {},
  ): Promise<Order> {
    const orderStatus = status as OrderStatus;
    const existing = await this.ordersRepo.findOneOrFail({ where: { id } });

    await this.ordersRepo.update(id, {
      orderStatus,
      ...updates,
    });
    const order = await this.ordersRepo.findOneOrFail({ where: { id } });

    // Stamp file expiry when order reaches either terminal completion status
    if (
      (orderStatus === OrderStatus.COMPLETED_PICKUP ||
        orderStatus === OrderStatus.DELIVERED) &&
      order.fileMetadataId != null
    ) {
      const owner = await this.usersService.findById(order.userId);
      if (owner?.fileRetentionDays != null) {
        await this.filesService.stampExpiry(
          order.fileMetadataId,
          owner.fileRetentionDays,
        );
      }
    }

    if (
      orderStatus === OrderStatus.DELIVERED ||
      orderStatus === OrderStatus.COMPLETED_PICKUP
    ) {
      try {
        await this.tamSurveysService.createPostDeliveryRequirementIfNeeded(
          order,
        );
      } catch (err) {
        this.logger.warn(
          `Post-delivery survey requirement failed for order ${order.orderId}: ${err}`,
        );
      }
    }

    // Status → notification copy (shared by FCM push + in-app notification)
    const messages: Record<string, { title: string; body: string }> = {
      file_verified: {
        title: 'File Verified',
        body: `Your order ${order.orderId} file has been verified.`,
      },
      printing_in_progress: {
        title: 'Printing Started',
        body: `Your order ${order.orderId} is being printed.`,
      },
      quality_checked: {
        title: 'Quality Checked',
        body: `Your order ${order.orderId} passed quality check.`,
      },
      ready_for_dispatch: {
        title: 'Ready for Dispatch',
        body: `Your order ${order.orderId} is ready.`,
      },
      driver_assigned: {
        title: 'Driver Assigned',
        body: `A driver has been assigned to your order ${order.orderId}.`,
      },
      picked_up: {
        title: 'Picked Up',
        body: `Your order ${order.orderId} has been picked up.`,
      },
      on_the_way: {
        title: 'On The Way',
        body: `Your order ${order.orderId} is on the way!`,
      },
      arrived_at_destination: {
        title: 'Driver Arrived',
        body: `Your delivery for ${order.orderId} has arrived!`,
      },
      delivered: {
        title: 'Delivered',
        body: `Your order ${order.orderId} has been delivered. Thank you!`,
      },
      cancelled: {
        title: 'Order Cancelled',
        body: `Your order ${order.orderId} has been cancelled.`,
      },
    };
    const statusMsg = messages[status];

    // Send push notification to order owner
    const fcmToken = await this.usersService.getFcmToken(existing.userId);
    if (fcmToken && statusMsg) {
      await this.firebaseService.sendToDevice(
        fcmToken,
        statusMsg.title,
        statusMsg.body,
        {
          orderId: order.orderId,
          status: status,
        },
      );
    }

    // Emit WebSocket order update
    void this.ordersGateway.notifyOrderUpdate(order.orderId, order);

    // Create in-app notification for the customer (also emitted via WS)
    if (statusMsg) {
      try {
        await this.notificationsService.create({
          userId: order.userId,
          title: statusMsg.title,
          message: statusMsg.body,
          type: `order_${status}`,
          orderRef: order.orderId,
          metadata: { orderId: order.id, toStatus: status },
        });
      } catch (err) {
        this.logger.warn(
          `Customer notification failed for status ${status}: ${err}`,
        );
      }
    }

    // Notify admins of cancellation / decline
    if (
      orderStatus === OrderStatus.CANCELLED ||
      orderStatus === OrderStatus.FILE_DECLINED
    ) {
      const type =
        orderStatus === OrderStatus.CANCELLED
          ? 'order_cancelled'
          : 'order_declined';
      try {
        await this.notificationsService.createForAllAdmins({
          title:
            orderStatus === OrderStatus.CANCELLED
              ? 'Order Cancelled'
              : 'Order Declined',
          message: `Order ${order.orderId} was ${orderStatus === OrderStatus.CANCELLED ? 'cancelled' : 'declined'}.`,
          type,
          orderRef: order.orderId,
          metadata: { orderId: order.id, toStatus: status },
        });
      } catch (err) {
        this.logger.warn(
          `Admin notification failed for status ${status}: ${err}`,
        );
      }
    }

    return order;
  }
}
