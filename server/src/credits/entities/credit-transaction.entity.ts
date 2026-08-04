import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * Pilot Credits ledger events (PRD §7.5).
 * Legacy `top_up` / `deduction` remain for beta enrollment, historical
 * top-ups, and refund rows until Phase 11 cutover.
 */
export enum CreditTransactionType {
  /** @deprecated Prefer GRANT for pilot grants */
  TOP_UP = 'top_up',
  /** @deprecated Prefer SPEND for pilot spends */
  DEDUCTION = 'deduction',
  GRANT = 'grant',
  RESERVE = 'reserve',
  SPEND = 'spend',
  RELEASE = 'release',
  EXPIRE = 'expire',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
}

export enum CreditTransactionStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('credit_transactions')
@Index('uq_credit_transactions_beta_enrollment_reference', ['referenceId'], {
  unique: true,
  where: `"reference_id" LIKE 'BETA-ENROLLMENT:%'`,
})
@Index('uq_credit_transactions_refund_reference', ['referenceId'], {
  unique: true,
  where:
    `"reference_id" LIKE 'ORDER-REFUND:%' OR ` +
    `"reference_id" LIKE 'BATCH-REFUND:%'`,
})
@Index('uq_credit_transactions_idempotency_key', ['idempotencyKey'], {
  unique: true,
  where: `"idempotency_key" IS NOT NULL`,
})
export class CreditTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: CreditTransactionType })
  type: CreditTransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amountPhp: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountCredits: number;

  @Column({
    type: 'enum',
    enum: CreditTransactionStatus,
    default: CreditTransactionStatus.PENDING,
  })
  status: CreditTransactionStatus;

  @Column({ name: 'proof_of_payment_url', nullable: true, type: 'text' })
  proofOfPaymentUrl: string | null;

  @Column({ name: 'reference_id', type: 'varchar', nullable: true })
  referenceId: string | null;

  /** Required for reserve/spend; unique when set. */
  @Column({ name: 'idempotency_key', type: 'varchar', nullable: true })
  idempotencyKey: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'actor_user_id', type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({
    name: 'balance_before',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  balanceBefore: number | null;

  @Column({
    name: 'balance_after',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  balanceAfter: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
