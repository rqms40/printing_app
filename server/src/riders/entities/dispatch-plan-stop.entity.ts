import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeliveryAssignment } from './delivery-assignment.entity';
import { DispatchPlan } from './dispatch-plan.entity';
import type { LineStringGeometry } from '../routing/routing-provider';

export enum DispatchStopStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

@Entity('dispatch_plan_stops')
@Index('uq_dispatch_plan_stops_sequence', ['planId', 'sequence'], {
  unique: true,
})
@Index('uq_dispatch_plan_stops_assignment', ['planId', 'assignmentId'], {
  unique: true,
})
@Index('idx_dispatch_plan_stops_assignment', ['assignmentId'])
export class DispatchPlanStop {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'plan_id' })
  planId: number;

  @ManyToOne(() => DispatchPlan, (plan) => plan.stops, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: DispatchPlan;

  @Column({ name: 'assignment_id' })
  assignmentId: number;

  @ManyToOne(() => DeliveryAssignment, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: DeliveryAssignment;

  @Column({ type: 'int' })
  sequence: number;

  @Column({
    type: 'enum',
    enum: DispatchStopStatus,
    enumName: 'dispatch_stop_status_enum',
    default: DispatchStopStatus.PENDING,
  })
  status: DispatchStopStatus;

  @Column({
    name: 'destination_latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  destinationLatitude: number;

  @Column({
    name: 'destination_longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  destinationLongitude: number;

  @Column({ name: 'leg_duration_seconds', type: 'int' })
  legDurationSeconds: number;

  @Column({ name: 'leg_distance_meters', type: 'int' })
  legDistanceMeters: number;

  @Column({ name: 'leg_geometry', type: 'jsonb' })
  legGeometry: LineStringGeometry;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'skipped_at', type: 'timestamp', nullable: true })
  skippedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
