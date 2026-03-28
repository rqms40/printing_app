import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Order } from './order.entity';

@Entity('order_status_history')
@Index('idx_order_status_history_order', ['orderId'])
export class OrderStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'from_status', length: 30 })
  fromStatus: string;

  @Column({ name: 'to_status', length: 30 })
  toStatus: string;

  @Column({ name: 'changed_by_user_id' })
  changedByUserId: number;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
