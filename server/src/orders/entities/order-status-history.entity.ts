import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Order, type OrderStatus } from './order.entity';

@Entity('order_status_history')
@Index('idx_order_status_history_order', ['orderId'])
export class OrderStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, (o) => o.statusHistory)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'from_status', type: 'varchar', length: 30 })
  fromStatus: OrderStatus;

  @Column({ name: 'to_status', type: 'varchar', length: 30 })
  toStatus: OrderStatus;

  @Column({ name: 'changed_by_user_id' })
  changedByUserId: number;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
