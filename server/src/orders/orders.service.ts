import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from './entities/order.entity';
import { PaperSpec } from './entities/paper-specs.entity';
import { ThreeDSpec } from './entities/three-d-specs.entity';
import { OrdersGateway } from './orders.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { CreditsService } from '../credits/credits.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
    @InjectRepository(PaperSpec) private paperSpecsRepo: Repository<PaperSpec>,
    @InjectRepository(ThreeDSpec)
    private threeDSpecsRepo: Repository<ThreeDSpec>,
    private ordersGateway: OrdersGateway,
    private firebaseService: FirebaseService,
    private usersService: UsersService,
    private creditsService: CreditsService,
    private notificationsService: NotificationsService,
  ) {}

  async findByUser(userId: number): Promise<Order[]> {
    return this.ordersRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: number): Promise<Order | null> {
    return this.ordersRepo.findOne({ where: { id } });
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
      orderData.paymentMethod === 'credits' &&
      orderData.totalPrice &&
      orderData.totalPrice > 0
    ) {
      if (!orderData.userId) {
        throw new Error('User ID is required to process credit payment');
      }

      const userId = orderData.userId;
      const amountCredits = orderData.totalPrice; // 1 PHP = 1 Credit equivalent locally

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
      this.logger.warn(`Admin notification failed for order ${savedOrder.orderId}: ${err}`);
    }

    return savedOrder;
  }

  private static readonly CANCELLABLE_STATUSES: OrderStatus[] = [
    OrderStatus.ORDER_PLACED,
    OrderStatus.FILE_VERIFIED,
  ];

  async cancelOrder(id: number, userId: number): Promise<Order> {
    const order = await this.ordersRepo.findOneOrFail({ where: { id } });
    if (order.userId !== userId) {
      throw new Error('Forbidden');
    }
    if (!OrdersService.CANCELLABLE_STATUSES.includes(order.orderStatus as OrderStatus)) {
      throw new Error('Order cannot be cancelled at this stage');
    }
    return this.updateStatus(id, 'cancelled');
  }

  async updateStatus(id: number, status: string): Promise<Order> {
    const existing = await this.ordersRepo.findOneOrFail({ where: { id } });

    await this.ordersRepo.update(id, {
      orderStatus: status as OrderStatus,
    });
    const order = await this.ordersRepo.findOneOrFail({ where: { id } });

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
      await this.firebaseService.sendToDevice(fcmToken, statusMsg.title, statusMsg.body, {
        orderId: order.orderId,
        status: status,
      });
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
        this.logger.warn(`Customer notification failed for status ${status}: ${err}`);
      }
    }

    // Notify admins of cancellation / decline
    if (
      status === OrderStatus.CANCELLED ||
      status === OrderStatus.FILE_DECLINED
    ) {
      const type =
        status === OrderStatus.CANCELLED ? 'order_cancelled' : 'order_declined';
      try {
        await this.notificationsService.createForAllAdmins({
          title: status === OrderStatus.CANCELLED ? 'Order Cancelled' : 'Order Declined',
          message: `Order ${order.orderId} was ${status === OrderStatus.CANCELLED ? 'cancelled' : 'declined'}.`,
          type,
          orderRef: order.orderId,
          metadata: { orderId: order.id, toStatus: status },
        });
      } catch (err) {
        this.logger.warn(`Admin notification failed for status ${status}: ${err}`);
      }
    }

    return order;
  }
}
