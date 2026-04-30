import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  AgeRange,
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from '../profile.constants';
import { PrintMode } from '../../orders/print-mode.enum';

export enum UserRole {
  CUSTOMER = 'customer',
  DRIVER = 'driver',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'full_name', type: 'text', nullable: true })
  fullName: string | null;

  @Column({ type: 'text', nullable: true })
  nickname: string | null;

  @Column({ name: 'phone_number', type: 'text', nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'text', nullable: true })
  gender: string | null;

  @Column({
    name: 'age_range',
    type: 'enum',
    enum: AgeRange,
    nullable: true,
  })
  ageRange: AgeRange | null;

  @Column({ name: 'date_of_birth', type: 'timestamp', nullable: true })
  dateOfBirth: Date | null;

  @Column({
    name: 'profile_category',
    type: 'enum',
    enum: ProfileCategory,
    nullable: true,
  })
  profileCategory: ProfileCategory | null;

  @Column({
    name: 'profile_field',
    type: 'enum',
    enum: ProfileField,
    nullable: true,
  })
  profileField: ProfileField | null;

  @Column({ type: 'text', nullable: true })
  course: string | null;

  @Column({ type: 'text', nullable: true })
  organization: string | null;

  @Column({
    name: 'printing_preferences',
    type: 'simple-array',
    nullable: true,
  })
  printingPreferences: PrintingPreference[] | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ name: 'is_profile_complete', default: false })
  isProfileComplete: boolean;

  @Column({ name: 'fcm_token', nullable: true, type: 'text' })
  fcmToken: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'account_hold_reason', type: 'varchar', length: 50, nullable: true })
  accountHoldReason: string | null;

  @Column({ name: 'account_held_at', type: 'timestamp', nullable: true })
  accountHeldAt: Date | null;

  @Column({ name: 'beta_completed_at', type: 'timestamp', nullable: true })
  betaCompletedAt: Date | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  credits: number;

  @Column({
    name: 'file_retention_days',
    type: 'integer',
    nullable: true,
    default: null,
  })
  fileRetentionDays: number | null;

  @Column({ name: 'default_print_mode', type: 'varchar', length: 20, nullable: true, default: 'fitToPage' })
  defaultPrintMode: PrintMode | null;

  @Column({ name: 'is_beta_user', default: false })
  isBetaUser: boolean;

  @Column({ name: 'beta_enrolled_at', type: 'timestamp', nullable: true })
  betaEnrolledAt: Date | null;

  @Column({ name: 'beta_credits_granted', default: false })
  betaCreditsGranted: boolean;

  /**
   * When true, this user is exempt from the post-delivery TAM survey
   * lockout — they can keep logging in and using the app even when beta
   * mode is on and they have a pending requirement. Set by admin from
   * the Beta Members admin page.
   */
  @Column({ name: 'is_beta_survey_exempt', default: false })
  isBetaSurveyExempt: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
