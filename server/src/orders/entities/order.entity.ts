import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum OrderStatus {
  ORDER_PLACED = 'order_placed',
  FILE_VERIFIED = 'file_verified',
  FILE_DECLINED = 'file_declined',
  PRINTING_IN_PROGRESS = 'printing_in_progress',
  FINISHING_MOUNTING = 'finishing_mounting',
  QUALITY_CHECKED = 'quality_checked',
  READY_FOR_DISPATCH = 'ready_for_dispatch',
  DRIVER_ASSIGNED = 'driver_assigned',
  PICKED_UP = 'picked_up',
  ON_THE_WAY = 'on_the_way',
  ARRIVED_AT_DESTINATION = 'arrived_at_destination',
  DELIVERED = 'delivered',
  COMPLETED_PICKUP = 'completed_pickup',
  CANCELLED = 'cancelled',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', unique: true })
  orderId: string;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  category: string;

  @Column({ name: 'file_url', nullable: true })
  fileUrl: string;

  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @Column({ default: 1 })
  quantity: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ name: 'delivery_fee', type: 'decimal', precision: 10, scale: 2, default: 0 })
  deliveryFee: number;

  @Column({ name: 'payment_method' })
  paymentMethod: string;

  @Column({ name: 'payment_status', default: 'pending' })
  paymentStatus: string;

  @Column({ name: 'order_status', type: 'enum', enum: OrderStatus, default: OrderStatus.ORDER_PLACED })
  orderStatus: OrderStatus;

  @Column({ name: 'delivery_option', default: 'pickup' })
  deliveryOption: string;

  @Column({ name: 'estimated_completion_at', type: 'timestamp', nullable: true })
  estimatedCompletionAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
