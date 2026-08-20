import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import {
  AgeRange,
  ClientAccountType,
  MatchingPreference,
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from '../profile.constants';

export enum UserRole {
  CLIENT = 'client',
  SUPPLIER = 'supplier',
  RIDER = 'rider',
  OPS_ADMIN = 'ops_admin',
  SUPER_ADMIN = 'super_admin',
}

/** Ops Admin and Super Admin — former single `admin` capability surface. */
export const ADMIN_ROLES: readonly UserRole[] = [
  UserRole.OPS_ADMIN,
  UserRole.SUPER_ADMIN,
] as const;

export function isAdminRole(
  role: string | UserRole | null | undefined,
): boolean {
  return role === UserRole.OPS_ADMIN || role === UserRole.SUPER_ADMIN;
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

  /** Quality / price / speed — used to auto-match a supplier. Null = quality. */
  @Column({
    name: 'matching_preference',
    type: 'enum',
    enum: MatchingPreference,
    enumName: 'matching_preference_enum',
    nullable: true,
  })
  matchingPreference: MatchingPreference | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;

  /**
   * Optional client metadata: business | organization | teacher.
   * Null for non-clients and for clients who have not set a type.
   * Does not affect authorization or order workflows.
   */
  @Column({
    name: 'client_account_type',
    type: 'enum',
    enum: ClientAccountType,
    nullable: true,
  })
  clientAccountType: ClientAccountType | null;

  @Column({ name: 'is_profile_complete', default: false })
  isProfileComplete: boolean;

  @Index('uq_users_fcm_token', {
    unique: true,
    where: '"fcm_token" IS NOT NULL',
  })
  @Column({ name: 'fcm_token', nullable: true, type: 'text' })
  fcmToken: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    name: 'account_hold_reason',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
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

  @Column({
    name: 'default_payment_method',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  defaultPaymentMethod: 'gcash' | 'maya' | 'cod' | 'credits' | null;

  @Column({
    name: 'tutorial_seen_keys',
    type: 'text',
    array: true,
    default: [],
  })
  tutorialSeenKeys: string[];

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

  @Column({ name: 'beta_photo_file_id', type: 'int', nullable: true })
  betaPhotoFileId: number | null;

  @Column({
    name: 'beta_photo_uploaded_at',
    type: 'timestamptz',
    nullable: true,
  })
  betaPhotoUploadedAt: Date | null;

  @Column({ name: 'beta_shared_on_social', type: 'boolean', default: false })
  betaSharedOnSocial: boolean;

  /**
   * Pilot COD allow-list. Default false — Ops/Super Admin must verify the
   * client for cash-on-delivery before checkout can use method `cod`.
   * Distinct from Order.codEligible (per-order evaluation result).
   */
  @Column({ name: 'pilot_cod_eligible', type: 'boolean', default: false })
  pilotCodEligible: boolean;

  /**
   * Ops risk block for COD. When true, server rejects COD even if the client
   * is otherwise pilot-verified and under the ₱1,500 cap.
   */
  @Column({ name: 'cod_ops_risk_blocked', type: 'boolean', default: false })
  codOpsRiskBlocked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
