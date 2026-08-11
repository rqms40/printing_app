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
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';
import { RiderProfile } from '../../riders/entities/rider-profile.entity';

/** COD cash collection lifecycle (PRD §7.6 / decisions §4). */
export enum CodCollectionStatus {
  PENDING = 'pending',
  COLLECTED = 'collected',
  FAILED = 'failed',
  RECONCILED = 'reconciled',
}

/**
 * Cash-on-delivery collection record.
 * Cash collection ≠ payment authorization; payout blocked until reconciled.
 * Field contract: PRD_SysArchi §9.2 / PRD §10.
 * Money: PHP minor units (centavos) as bigint.
 */
@Entity('cod_collections')
@Index('uq_cod_collections_order_id', ['orderId'], { unique: true })
@Index('idx_cod_collections_rider_id', ['riderId'])
@Index('idx_cod_collections_status', ['status'])
export class CodCollection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'rider_id', type: 'int', nullable: true })
  riderId: number | null;

  @ManyToOne(() => RiderProfile, { nullable: true })
  @JoinColumn({ name: 'rider_id' })
  rider: RiderProfile | null;

  @Column({ type: 'boolean', default: false })
  eligible: boolean;

  @Column({ name: 'eligibility_reason', type: 'text', nullable: true })
  eligibilityReason: string | null;

  /** Amount to collect in PHP minor units (centavos). Cap: 150000 (₱1,500). */
  @Column({ name: 'amount_minor', type: 'bigint' })
  amountMinor: string;

  @Column({
    type: 'enum',
    enum: CodCollectionStatus,
    enumName: 'cod_collections_status_enum',
    default: CodCollectionStatus.PENDING,
  })
  status: CodCollectionStatus;

  /** Opaque OTP verification reference (not the raw OTP secret long-term). */
  @Column({ name: 'otp_ref', type: 'varchar', length: 255, nullable: true })
  otpRef: string | null;

  /** Photo / receipt file metadata id. */
  @Column({ name: 'photo_file_id', type: 'int', nullable: true })
  photoFileId: number | null;

  /** Additional proof refs (receipt keys, object paths). */
  @Column({ name: 'receipt_refs', type: 'jsonb', nullable: true })
  receiptRefs: Record<string, unknown> | null;

  @Column({ name: 'collected_at', type: 'timestamptz', nullable: true })
  collectedAt: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt: Date | null;

  @Column({ name: 'reconciled_at', type: 'timestamptz', nullable: true })
  reconciledAt: Date | null;

  @Column({ name: 'reconciled_by_user_id', type: 'int', nullable: true })
  reconciledByUserId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reconciled_by_user_id' })
  reconciledBy: User | null;

  @Column({ name: 'discrepancy_reason', type: 'text', nullable: true })
  discrepancyReason: string | null;

  @Column({ name: 'return_reason', type: 'text', nullable: true })
  returnReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
