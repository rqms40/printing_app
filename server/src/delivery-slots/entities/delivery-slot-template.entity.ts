import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('delivery_slot_templates')
export class DeliverySlotTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'day_of_week', type: 'int' })
  dayOfWeek: number; // 0 = Sunday … 6 = Saturday

  @Column({ name: 'start_time', type: 'time' })
  startTime: string; // "09:30:00"

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @Column({ type: 'int', default: 10 })
  capacity: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
