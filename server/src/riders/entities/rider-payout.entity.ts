import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RiderProfile } from './rider-profile.entity';
import { DeliveryAssignment } from './delivery-assignment.entity';
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';

/** Ops/super payment to a rider for one completed delivery. */
@Entity('rider_payouts')
@Index('idx_rider_payouts_rider_id', ['riderId'])
@Index('idx_rider_payouts_order_id', ['orderId'])
@Index('uq_rider_payouts_assignment_id', ['assignmentId'], { unique: true })
export class RiderPayout {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rider_id', type: 'int' })
  riderId: number;

  @ManyToOne(() => RiderProfile)
  @JoinColumn({ name: 'rider_id' })
  rider: RiderProfile;

  @Column({ name: 'assignment_id', type: 'int' })
  assignmentId: number;

  @ManyToOne(() => DeliveryAssignment)
  @JoinColumn({ name: 'assignment_id' })
  assignment: DeliveryAssignment;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** Delivery fee paid to the rider, PHP minor units. */
  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor: string;

  @Column({ name: 'admin_receipt_file_id', type: 'int', nullable: true })
  adminReceiptFileId: number | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ name: 'paid_by_user_id', type: 'int', nullable: true })
  paidByUserId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'paid_by_user_id' })
  paidBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
