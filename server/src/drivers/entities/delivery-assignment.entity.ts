import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { DriverProfile } from './driver-profile.entity';
import { Order } from '../../orders/entities/order.entity';

export enum DeliveryStatus {
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  PICKED_UP = 'picked_up',
  ON_THE_WAY = 'on_the_way',
  ARRIVED = 'arrived',
  DELIVERED = 'delivered',
}

@Entity('delivery_assignments')
@Index('idx_delivery_assignments_order', ['orderId'])
@Index('idx_delivery_assignments_driver', ['driverId'])
@Index('idx_delivery_assignments_status', ['status'])
export class DeliveryAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'driver_id' })
  driverId: number;

  @ManyToOne(() => DriverProfile)
  @JoinColumn({ name: 'driver_id' })
  driver: DriverProfile;

  @Column({ type: 'enum', enum: DeliveryStatus, default: DeliveryStatus.ASSIGNED })
  status: DeliveryStatus;

  @Column({ name: 'assigned_at', type: 'timestamp', default: () => 'NOW()' })
  assignedAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @Column({ name: 'picked_up_at', type: 'timestamp', nullable: true })
  pickedUpAt: Date;

  @Column({ name: 'on_the_way_at', type: 'timestamp', nullable: true })
  onTheWayAt: Date;

  @Column({ name: 'arrived_at', type: 'timestamp', nullable: true })
  arrivedAt: Date;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ name: 'decline_reason', nullable: true, type: 'text' })
  declineReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
