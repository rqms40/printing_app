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
    if (orderData.paymentMethod === 'credits' && orderData.totalPrice && orderData.totalPrice > 0) {
      if (!orderData.userId) {
         throw new Error('User ID is required to process credit payment');
      }
      
      const userId = orderData.userId;
      const amountCredits = orderData.totalPrice; // 1 PHP = 1 Credit equivalent locally
      
      // Attempt subtraction, will throw BadRequestException if insufficient
      await this.creditsService.subtractCredits(userId, amountCredits, 'order_placed');
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

    return savedOrder;
  }

  async updateStatus(id: number, status: string): Promise<Order> {
    const existing = await this.ordersRepo.findOneOrFail({ where: { id } });

    await this.ordersRepo.update(id, {
      orderStatus: status as OrderStatus,
    });
    const order = await this.ordersRepo.findOneOrFail({ where: { id } });

    // Send push notification to order owner
    const fcmToken = await this.usersService.getFcmToken(existing.userId);
    if (fcmToken) {
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

      const msg = messages[status];
      if (msg) {
        await this.firebaseService.sendToDevice(fcmToken, msg.title, msg.body, {
          orderId: order.orderId,
          status: status,
        });
      }
    }

    // Emit WebSocket update
    void this.ordersGateway.notifyOrderUpdate(order.orderId, order);
    return order;
  }
}
