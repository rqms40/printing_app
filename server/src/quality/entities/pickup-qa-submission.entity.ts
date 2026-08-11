import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { User } from '../../users/entities/user.entity';
import type {
  PickupQaActorRole,
  PickupQaChecklistResults,
} from '../pickup-qa-checklist';

/**
 * Supplier or rider physical pickup QA submission.
 * Shown in ops/superadmin QA Queue (Pickup QA tab).
 */
@Entity('pickup_qa_submissions')
@Index('idx_pickup_qa_order_id', ['orderId'])
@Index('idx_pickup_qa_actor_role', ['actorRole'])
@Index('idx_pickup_qa_created_at', ['createdAt'])
export class PickupQaSubmission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'actor_role', type: 'varchar', length: 20 })
  actorRole: PickupQaActorRole;

  @Column({ name: 'actor_user_id', type: 'int' })
  actorUserId: number;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actor_user_id' })
  actor: User | null;

  @Column({ name: 'supplier_assignment_id', type: 'int', nullable: true })
  supplierAssignmentId: number | null;

  @Column({ name: 'delivery_assignment_id', type: 'int', nullable: true })
  deliveryAssignmentId: number | null;

  @Column({ name: 'checklist_results', type: 'jsonb' })
  checklistResults: PickupQaChecklistResults;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    name: 'evidence_file_ids',
    type: 'jsonb',
    default: () => "'[]'",
  })
  evidenceFileIds: number[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
