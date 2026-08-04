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
import { Order } from '../../orders/entities/order.entity';

/**
 * Immutable controlled-event audit row (append-only).
 * Written for QA, assignment, payment/credit/COD, production, claims,
 * refunds, payouts, overrides, and order status transitions.
 * Field contract: PRD_SysArchi §9 / decisions §3.
 */
@Entity('audit_events')
@Index('idx_audit_events_entity', ['entityType', 'entityId'])
@Index('idx_audit_events_order_id', ['orderId'])
@Index('idx_audit_events_actor_id', ['actorId'])
@Index('idx_audit_events_action', ['action'])
@Index('uq_audit_events_idempotency_key', ['idempotencyKey'], {
  unique: true,
  where: '"idempotency_key" IS NOT NULL',
})
export class AuditEvent {
  @PrimaryGeneratedColumn()
  id: number;

  /** Actor user id; null for system/scheduled jobs. */
  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor: User | null;

  /** Role string at time of event (client, ops_admin, system, …). */
  @Column({ name: 'actor_role', type: 'varchar', length: 40, nullable: true })
  actorRole: string | null;

  /** Controlled action name, e.g. status_transition, qa_decision, payout_release. */
  @Column({ type: 'varchar', length: 80 })
  action: string;

  /** Domain entity type, e.g. order, quality_review, payout. */
  @Column({ name: 'entity_type', type: 'varchar', length: 80 })
  entityType: string;

  /** Entity primary key as string for cross-table generality. */
  @Column({ name: 'entity_id', type: 'varchar', length: 64 })
  entityId: string;

  /** Denormalized order link when the event is order-scoped. */
  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ name: 'from_state', type: 'varchar', length: 60, nullable: true })
  fromState: string | null;

  @Column({ name: 'to_state', type: 'varchar', length: 60, nullable: true })
  toState: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** Additional structured metadata (never secrets). */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, unknown>;

  /**
   * Optional idempotency key for repeating controlled writes
   * (payment, credit, webhook, SLA jobs).
   */
  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  idempotencyKey: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
