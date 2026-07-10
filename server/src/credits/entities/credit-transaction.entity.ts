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

export enum CreditTransactionType {
  TOP_UP = 'top_up',
  DEDUCTION = 'deduction',
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
  amountPhp: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amountCredits: number;

  @Column({
    type: 'enum',
    enum: CreditTransactionStatus,
    default: CreditTransactionStatus.PENDING,
  })
  status: CreditTransactionStatus;

  @Column({ name: 'proof_of_payment_url', nullable: true, type: 'text' })
  proofOfPaymentUrl: string;

  @Column({ name: 'reference_id', type: 'varchar', nullable: true })
  referenceId: string | null; // e.g., Order ID for deductions

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
