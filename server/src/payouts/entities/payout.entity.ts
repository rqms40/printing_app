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
import { SupplierProfile } from '../../suppliers/entities/supplier-profile.entity';
import { User } from '../../users/entities/user.entity';

/** Supplier settlement lifecycle (PRD §7.11). */
export enum PayoutSettlementState {
  PENDING = 'pending',
  HELD = 'held',
  RELEASED = 'released',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
}

/**
 * Supplier payout for an order — gross/commission/net in PHP minor units.
 * Holds: open issue, missing COD recon, quality claim, manual Ops hold.
 * Field contract: PRD_SysArchi §9.2 / PRD §7.11.
 */
@Entity('payouts')
@Index('idx_payouts_order_id', ['orderId'])
@Index('idx_payouts_supplier_id', ['supplierId'])
@Index('idx_payouts_settlement_state', ['settlementState'])
export class Payout {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id', type: 'int' })
  supplierId: number;

  @ManyToOne(() => SupplierProfile)
  @JoinColumn({ name: 'supplier_id' })
  supplier: SupplierProfile;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** Gross amount in PHP minor units (centavos). */
  @Column({ name: 'gross_minor', type: 'bigint' })
  grossMinor: string;

  /** Platform commission in PHP minor units (centavos). */
  @Column({ name: 'commission_minor', type: 'bigint' })
  commissionMinor: string;

  /** Net payable = gross − commission (± adjustments), PHP minor units. */
  @Column({ name: 'net_minor', type: 'bigint' })
  netMinor: string;

  @Column({ name: 'hold_reason', type: 'text', nullable: true })
  holdReason: string | null;

  @Column({ name: 'hold_expires_at', type: 'timestamptz', nullable: true })
  holdExpiresAt: Date | null;

  @Column({ name: 'release_authority_id', type: 'int', nullable: true })
  releaseAuthorityId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'release_authority_id' })
  releaseAuthority: User | null;

  @Column({
    name: 'settlement_state',
    type: 'enum',
    enum: PayoutSettlementState,
    enumName: 'payouts_settlement_state_enum',
    default: PayoutSettlementState.PENDING,
  })
  settlementState: PayoutSettlementState;

  @Column({
    name: 'settlement_reference',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  settlementReference: string | null;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt: Date | null;

  /** Ops/super receipt proving GRIDGO paid this supplier. */
  @Column({ name: 'admin_receipt_file_id', type: 'int', nullable: true })
  adminReceiptFileId: number | null;

  @Column({ name: 'authorized_at', type: 'timestamptz', nullable: true })
  authorizedAt: Date | null;

  @Column({ name: 'authorized_by_user_id', type: 'int', nullable: true })
  authorizedByUserId: number | null;

  /** First 50% paid to the supplier at production authorize (PHP minor units). */
  @Column({ name: 'deposit_amount_minor', type: 'bigint', nullable: true })
  depositAmountMinor: string | null;

  /** Remaining 50% paid after order completion (PHP minor units). */
  @Column({ name: 'completion_amount_minor', type: 'bigint', nullable: true })
  completionAmountMinor: string | null;

  /** Ops/super receipt for the remaining 50% after delivery/collection. */
  @Column({ name: 'completion_receipt_file_id', type: 'int', nullable: true })
  completionReceiptFileId: number | null;

  @Column({
    name: 'completion_authorized_at',
    type: 'timestamptz',
    nullable: true,
  })
  completionAuthorizedAt: Date | null;

  @Column({
    name: 'completion_authorized_by_user_id',
    type: 'int',
    nullable: true,
  })
  completionAuthorizedByUserId: number | null;

  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true })
  settledAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
