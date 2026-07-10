import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RiderProfile } from './rider-profile.entity';
import { DispatchPlanStop } from './dispatch-plan-stop.entity';

export enum DispatchPlanStatus {
  ACTIVE = 'active',
  SUPERSEDED = 'superseded',
  COMPLETED = 'completed',
}

@Entity('dispatch_plans')
@Index('uq_dispatch_plans_rider_version', ['riderId', 'version'], {
  unique: true,
})
@Index('idx_dispatch_plans_rider_status', ['riderId', 'status'])
export class DispatchPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'rider_id' })
  riderId: number;

  @ManyToOne(() => RiderProfile, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'rider_id' })
  rider: RiderProfile;

  @Column({ type: 'int' })
  version: number;

  @Column({
    type: 'enum',
    enum: DispatchPlanStatus,
    enumName: 'dispatch_plan_status_enum',
    default: DispatchPlanStatus.ACTIVE,
  })
  status: DispatchPlanStatus;

  @Column({ name: 'origin_latitude', type: 'decimal', precision: 10, scale: 7 })
  originLatitude: number;

  @Column({
    name: 'origin_longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  originLongitude: number;

  @Column({ length: 40 })
  provider: string;

  @Column({ length: 40 })
  profile: string;

  @Column({ name: 'total_duration_seconds', type: 'int' })
  totalDurationSeconds: number;

  @Column({ name: 'total_distance_meters', type: 'int' })
  totalDistanceMeters: number;

  @Column({ name: 'routing_data_stale', default: false })
  routingDataStale: boolean;

  @Column({ name: 'planned_at', type: 'timestamp' })
  plannedAt: Date;

  @Column({ name: 'superseded_at', type: 'timestamp', nullable: true })
  supersededAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @OneToMany(() => DispatchPlanStop, (stop) => stop.plan)
  stops: DispatchPlanStop[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
