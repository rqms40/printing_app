import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('marketing_notifications')
export class MarketingNotification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  description: string;

  @Column()
  header: string;

  @Column()
  body: string;

  @Column({
    name: 'image_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  imageUrl: string | null;

  @Column()
  frequency: string; // e.g., '6h', 'daily', 'monthly'

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastSentAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
