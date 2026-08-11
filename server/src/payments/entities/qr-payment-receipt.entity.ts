import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { BatchOrder } from '../../orders/entities/batch-order.entity';
import { User } from '../../users/entities/user.entity';
import { FileMetadata } from '../../files/entities/file-metadata.entity';

export enum QrPaymentReceiptStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

/**
 * Customer QR Ph (Instapay) payment receipt attached at checkout.
 * Ops/superadmin verifies in the QR Payments queue before production auth.
 */
@Entity('qr_payment_receipts')
@Index('idx_qr_payment_receipts_status', ['status'])
@Index('idx_qr_payment_receipts_created_at', ['createdAt'])
@Index('idx_qr_payment_receipts_user_id', ['userId'])
export class QrPaymentReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unique: true })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'batch_order_id', type: 'int', nullable: true })
  batchOrderId: number | null;

  @ManyToOne(() => BatchOrder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'batch_order_id' })
  batchOrder: BatchOrder | null;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'file_id', type: 'int' })
  fileId: number;

  @ManyToOne(() => FileMetadata, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'file_id' })
  file: FileMetadata;

  @Column({
    type: 'varchar',
    length: 20,
    default: QrPaymentReceiptStatus.PENDING,
  })
  status: QrPaymentReceiptStatus;

  @Column({ name: 'verified_by_user_id', type: 'int', nullable: true })
  verifiedByUserId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'verified_by_user_id' })
  verifiedBy: User | null;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt: Date | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
