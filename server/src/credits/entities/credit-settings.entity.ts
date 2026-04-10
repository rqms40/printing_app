import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('credit_settings')
export class CreditSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 1.0 })
  conversionRate: number; // e.g. 1.0 means 1 PHP = 1 Credit. 1.2 means 1 PHP = 1.2 Credits.

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
