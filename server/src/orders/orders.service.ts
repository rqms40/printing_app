import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { BatchOrder } from './entities/batch-order.entity';
import { PaperSpec } from './entities/paper-specs.entity';
import { ThreeDSpec } from './entities/three-d-specs.entity';
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
import { CreateBatchOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(PaperSpec) private paperSpecsRepo: Repository<PaperSpec>,
    @InjectRepository(ThreeDSpec)
    private threeDSpecsRepo: Repository<ThreeDSpec>,
    @InjectRepository(DeliveryAssignment)
    private deliveryAssignmentRepo: Repository<DeliveryAssignment>,
    private ordersGateway: OrdersGateway,
    private firebaseService: FirebaseService,
    private usersService: UsersService,
    private creditsService: CreditsService,
    private notificationsService: NotificationsService,
    private filesService: FilesService,
    private dataSource: DataSource,
  ) {}

  async findByUser(userId: number): Promise<Order[]> {
    const orders = await this.ordersRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return this.attachDeliveryAssignmentIds(orders);
  }

  async findById(id: number): Promise<Order | null> {
    const order = await this.ordersRepo.findOne({ where: { id } });
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

  async create(
    data: Partial<Order> & {
      paperSpecs?: Partial<PaperSpec>;
      threeDSpecs?: Partial<ThreeDSpec>;
    },
  ): Promise<Order> {
    const { paperSpecs, threeDSpecs, ...orderData } = data;

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

    if (paperSpecs) {
      const spec = this.paperSpecsRepo.create({
        orderId: savedOrder.id,
        ...paperSpecs,
      });
      await this.paperSpecsRepo.save(spec);
    }
    if (threeDSpecs) {
      const spec = this.threeDSpecsRepo.create({
        orderId: savedOrder.id,
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
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Batch order requires at least one item');
    }

    const subtotal = dto.items.reduce(
      (sum, item) => sum + Number(item.totalPrice),
      0,
    );
    const deliveryFee = Number(dto.deliveryFee ?? 0);
    const totalPrice = subtotal + deliveryFee;

    const orders = await this.dataSource.transaction(async (manager) => {
      const batchOrdersRepo = manager.getRepository(BatchOrder);
      const txOrdersRepo = manager.getRepository(Order);
      const txPaperSpecsRepo = manager.getRepository(PaperSpec);
      const txThreeDSpecsRepo = manager.getRepository(ThreeDSpec);

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
        deliveryAddressId: dto.deliveryAddressId,
      });
      const savedBatch = await batchOrdersRepo.save(batch);

      const orderCount = await txOrdersRepo.count();
      const savedOrders: Order[] = [];

      for (const [index, item] of dto.items.entries()) {
        const orderId = `ORD-${(10001 + orderCount + index)
          .toString()
          .padStart(5, '0')}`;
        const order = txOrdersRepo.create({
          userId,
          orderId,
          category: item.category,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          deliveryFee: index === 0 ? deliveryFee : 0,
          paymentMethod: dto.paymentMethod,
          paymentStatus: dto.paymentStatus ?? 'pending',
          deliveryOption: dto.deliveryOption,
          deliveryAddressId: dto.deliveryAddressId,
          fileName: item.fileName,
          fileUrl: item.fileUrl,
          fileMetadataId: item.fileMetadataId,
          batchOrderId: savedBatch.id,
        });
        const savedOrder = await txOrdersRepo.save(order);

        if (item.paperSpecs) {
          const spec = txPaperSpecsRepo.create({
            orderId: savedOrder.id,
            ...item.paperSpecs,
          });
          await txPaperSpecsRepo.save(spec);
        }
        if (item.threeDSpecs) {
          const spec = txThreeDSpecsRepo.create({
            orderId: savedOrder.id,
            ...item.threeDSpecs,
          });
          await txThreeDSpecsRepo.save(spec);
        }

        savedOrders.push(savedOrder);
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

      return { batchRef: savedBatch.batchRef, orders: savedOrders };
    });

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

  async cancelOrder(id: number, userId: number): Promise<Order> {
    const order = await this.ordersRepo.findOneOrFail({ where: { id } });
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
