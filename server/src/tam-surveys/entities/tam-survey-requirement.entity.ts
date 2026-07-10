import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { TamSurvey } from './tam-survey.entity';

export enum TamSurveyRequirementReason {
  POST_DELIVERY = 'post_delivery',
}

export enum TamSurveyRequirementStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
}

@Entity('tam_survey_requirements')
@Index('idx_tam_survey_requirements_user_status', ['userId', 'status'])
@Index('uq_tam_survey_requirements_user_pending', ['userId'], {
  unique: true,
  where: `"status" = 'pending'`,
})
@Index('uq_tam_survey_requirements_order_reason', ['orderId', 'reason'], {
  unique: true,
})
export class TamSurveyRequirement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({
    type: 'enum',
    enum: TamSurveyRequirementReason,
    default: TamSurveyRequirementReason.POST_DELIVERY,
  })
  reason: TamSurveyRequirementReason;

  @Column({
    type: 'enum',
    enum: TamSurveyRequirementStatus,
    default: TamSurveyRequirementStatus.PENDING,
  })
  status: TamSurveyRequirementStatus;

  @Column({ name: 'survey_id', type: 'int', nullable: true })
  surveyId: number | null;

  @OneToOne(() => TamSurvey, { nullable: true })
  @JoinColumn({ name: 'survey_id' })
  survey: TamSurvey | null;

  @Column({ name: 'required_at', type: 'timestamp' })
  requiredAt: Date;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
