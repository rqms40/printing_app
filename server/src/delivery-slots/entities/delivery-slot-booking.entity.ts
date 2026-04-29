import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { DeliverySlotTemplate } from './delivery-slot-template.entity';

@Entity('delivery_slot_bookings')
@Unique('uq_slot_booking_batch', ['batchOrderId'])
@Index('idx_slot_booking_template_date', ['slotTemplateId', 'date'])
export class DeliverySlotBooking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'slot_template_id', type: 'int' })
  slotTemplateId: number;

  @ManyToOne(() => DeliverySlotTemplate)
  @JoinColumn({ name: 'slot_template_id' })
  slotTemplate: DeliverySlotTemplate;

  @Column({ type: 'date' })
  date: string; // "YYYY-MM-DD"

  @Column({ name: 'batch_order_id', type: 'int' })
  batchOrderId: number;

  @Column({ default: false })
  priority: boolean;

  @Column({ name: 'priority_rank', type: 'int', nullable: true })
  priorityRank: number | null;

  @CreateDateColumn({ name: 'booked_at' })
  bookedAt: Date;
}
