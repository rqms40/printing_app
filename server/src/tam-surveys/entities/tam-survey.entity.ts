import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { TamSurveyRequirement } from './tam-survey-requirement.entity';

@Entity('tam_surveys')
export class TamSurvey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ name: 'requirement_id', type: 'int', nullable: true })
  requirementId: number | null;

  @ManyToOne(() => TamSurveyRequirement, { nullable: true })
  @JoinColumn({ name: 'requirement_id' })
  requirement: TamSurveyRequirement | null;

  @Column({ name: 'survey_data', type: 'jsonb' })
  surveyData: Record<string, number>;

  @Column({ name: 'open_forum_feedback', type: 'text', nullable: true })
  openForumFeedback: string;

  @Column({ name: 'is_approved_for_feed', type: 'boolean', default: false })
  isApprovedForFeed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
