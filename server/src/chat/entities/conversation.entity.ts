import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ConversationType {
  AI = 'ai',
  ADMIN = 'admin',
  RIDER = 'rider',
}

export enum ConversationStatus {
  OPEN = 'open',
  ASSIGNED = 'assigned',
  CLOSED = 'closed',
}

@Entity('chat_conversations')
@Index('idx_conv_customer_status', ['customerId', 'status'])
@Index('idx_conv_status_type', ['status', 'type'])
export class Conversation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id' })
  customerId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'customer_id' })
  customer: User;

  @Column({ type: 'enum', enum: ConversationType })
  type: ConversationType;

  @Column({ name: 'order_id', nullable: true })
  orderId: number;

  @Column({ name: 'assigned_admin_id', nullable: true })
  assignedAdminId: number;

  @Column({ name: 'assigned_rider_id', nullable: true })
  assignedRiderId: number;

  @Column({
    type: 'enum',
    enum: ConversationStatus,
    default: ConversationStatus.OPEN,
  })
  status: ConversationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date;

  @OneToMany('ChatMessage', 'conversation')
  messages: any[];
}
