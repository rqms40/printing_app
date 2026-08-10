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

/** Material claim lifecycle (PRD §7.10). */
export enum IssueStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED_REFUND = 'resolved_refund',
  RESOLVED_REPRINT = 'resolved_reprint',
  RESOLVED_ADJUSTMENT = 'resolved_adjustment',
  REJECTED = 'rejected',
  CLOSED = 'closed',
}

export enum IssuePayoutImpact {
  NONE = 'none',
  HOLD = 'hold',
  FREEZE = 'freeze',
  RELEASE = 'release',
}

/**
 * Material print/delivery claim within or outside the 24h issue window.
 * Field contract: PRD §7.10 / PRD_SysArchi §9.1.
 * Money: PHP minor units (centavos) as bigint.
 */
@Entity('issues')
@Index('idx_issues_order_id', ['orderId'])
@Index('idx_issues_status', ['status'])
@Index('idx_issues_opened_by', ['openedByUserId'])
export class Issue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', length: 80 })
  category: string;

  /** Evidence refs (file ids, photos, notes) — not raw binaries. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidence: unknown[];

  /** Window / resolution deadline (typically delivery_proof + 24h). */
  @Column({ type: 'timestamptz', nullable: true })
  deadline: Date | null;

  @Column({
    type: 'enum',
    enum: IssueStatus,
    enumName: 'issues_status_enum',
    default: IssueStatus.OPEN,
  })
  status: IssueStatus;

  @Column({
    name: 'payout_impact',
    type: 'enum',
    enum: IssuePayoutImpact,
    enumName: 'issues_payout_impact_enum',
    default: IssuePayoutImpact.HOLD,
  })
  payoutImpact: IssuePayoutImpact;

  /** Refund amount in PHP minor units when applicable. */
  @Column({ name: 'refund_amount_minor', type: 'bigint', nullable: true })
  refundAmountMinor: string | null;

  /** Adjustment amount in PHP minor units when applicable. */
  @Column({ name: 'adjustment_amount_minor', type: 'bigint', nullable: true })
  adjustmentAmountMinor: string | null;

  @Column({ name: 'opened_by_user_id', type: 'int' })
  openedByUserId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'opened_by_user_id' })
  openedBy: User;

  @Column({ name: 'resolved_by_user_id', type: 'int', nullable: true })
  resolvedByUserId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolved_by_user_id' })
  resolvedBy: User | null;

  @Column({ name: 'resolution_notes', type: 'text', nullable: true })
  resolutionNotes: string | null;

  /** True when opened within the 24h material issue window. */
  @Column({ name: 'within_window', type: 'boolean', default: true })
  withinWindow: boolean;

  @Column({ name: 'opened_at', type: 'timestamptz', default: () => 'NOW()' })
  openedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
