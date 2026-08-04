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

/** Ops QA decision outcomes (PRD §7.3). */
export enum QualityReviewDecision {
  NEEDS_CORRECTION = 'needs_correction',
  PROOF_APPROVAL = 'proof_approval',
  APPROVED_FOR_MATCHING = 'approved_for_matching',
  BLOCKED = 'blocked',
}

export enum QualityReviewRiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * Ops QualityReview record — mandatory QA gate before matching.
 * Field contract: PRD_SysArchi §9.2 / PRD §7.3.
 */
@Entity('quality_reviews')
@Index('idx_quality_reviews_order_id', ['orderId'])
@Index('idx_quality_reviews_reviewer_id', ['reviewerId'])
export class QualityReview {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'reviewer_id', type: 'int' })
  reviewerId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: User;

  /** Structured checklist pass/fail results (keys defined by Ops policy). */
  @Column({ name: 'checklist_results', type: 'jsonb', default: () => "'{}'" })
  checklistResults: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: QualityReviewDecision,
    enumName: 'quality_reviews_decision_enum',
  })
  decision: QualityReviewDecision;

  @Column({
    name: 'risk_level',
    type: 'enum',
    enum: QualityReviewRiskLevel,
    enumName: 'quality_reviews_risk_level_enum',
    default: QualityReviewRiskLevel.LOW,
  })
  riskLevel: QualityReviewRiskLevel;

  @Column({ name: 'correction_request', type: 'text', nullable: true })
  correctionRequest: string | null;

  @Column({ name: 'proof_required', type: 'boolean', default: false })
  proofRequired: boolean;

  /** Evidence refs (file ids, object keys, note blobs) — not raw binaries. */
  @Column({ type: 'jsonb', nullable: true })
  evidence: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
