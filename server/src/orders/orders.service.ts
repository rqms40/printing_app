import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private ordersRepo: Repository<Order>,
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

  async create(data: Partial<Order>): Promise<Order> {
    const count = await this.ordersRepo.count();
    const orderId = `ORD-${(10001 + count).toString().padStart(5, '0')}`;
    const order = this.ordersRepo.create({ ...data, orderId });
    return this.ordersRepo.save(order);
  }

  async updateStatus(id: number, status: string): Promise<Order> {
    await this.ordersRepo.update(id, { orderStatus: status as any });
    return this.ordersRepo.findOneOrFail({ where: { id } });
  }
}
