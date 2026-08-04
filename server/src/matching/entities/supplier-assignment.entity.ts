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

/** Assignment lifecycle (accept SLA default 24h — PRD §7.4). */
export enum SupplierAssignmentDecision {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

/**
 * Ranked supplier assignment for an order.
 * Field contract: PRD_SysArchi §9.2 / PRD §7.4.
 * Money: PHP minor units (centavos) as bigint.
 */
@Entity('supplier_assignments')
@Index('idx_supplier_assignments_order_id', ['orderId'])
@Index('idx_supplier_assignments_supplier_id', ['supplierId'])
@Index('idx_supplier_assignments_decision', ['decision'])
export class SupplierAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'supplier_id', type: 'int' })
  supplierId: number;

  @ManyToOne(() => SupplierProfile)
  @JoinColumn({ name: 'supplier_id' })
  supplier: SupplierProfile;

  /** Snapshot of ranking inputs used at assignment time (immutable for audit). */
  @Column({ name: 'ranking_inputs', type: 'jsonb', default: () => "'{}'" })
  rankingInputs: Record<string, unknown>;

  /** 1-based rank among candidates at assignment time. */
  @Column({ name: 'rank_position', type: 'int', default: 1 })
  rankPosition: number;

  @Column({ name: 'acceptance_deadline', type: 'timestamptz' })
  acceptanceDeadline: Date;

  @Column({
    type: 'enum',
    enum: SupplierAssignmentDecision,
    enumName: 'supplier_assignments_decision_enum',
    default: SupplierAssignmentDecision.PENDING,
  })
  decision: SupplierAssignmentDecision;

  @Column({ name: 'decision_reason', type: 'text', nullable: true })
  decisionReason: string | null;

  /** Final committed price in PHP minor units (centavos). */
  @Column({ name: 'final_price_minor', type: 'bigint', nullable: true })
  finalPriceMinor: string | null;

  @Column({ name: 'promised_date', type: 'timestamptz', nullable: true })
  promisedDate: Date | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
