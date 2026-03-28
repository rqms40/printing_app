import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Order } from '../../orders/entities/order.entity';

@Entity('payment_transactions')
@Index('idx_payment_transactions_order', ['orderId'])
export class PaymentTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'payment_method', length: 10 })
  paymentMethod: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'pending', length: 10 })
  status: string; // pending, success, failed, refunded

  @Column({ name: 'external_reference_id', nullable: true, length: 255 })
  externalReferenceId: string;

  @Column({ name: 'webhook_payload', type: 'jsonb', nullable: true })
  webhookPayload: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
