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

/** Super Admin verification lifecycle for marketplace riders. */
export enum RiderVerificationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('rider_profiles')
export class RiderProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'vehicle_type', length: 20 })
  vehicleType: string;

  @Column({ name: 'plate_number', nullable: true, length: 20 })
  plateNumber: string;

  @Column({ name: 'license_number', nullable: true, length: 50 })
  licenseNumber: string;

  @Column({ name: 'is_available', default: false })
  isAvailable: boolean;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: RiderVerificationStatus,
    enumName: 'rider_verification_status_enum',
    default: RiderVerificationStatus.PENDING,
  })
  verificationStatus: RiderVerificationStatus;

  @Column({ name: 'verification_notes', type: 'text', nullable: true })
  verificationNotes: string | null;

  @Column({ name: 'verification_reviewed_by', type: 'int', nullable: true })
  verificationReviewedBy: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verification_reviewed_by' })
  verificationReviewer: User | null;

  @Column({
    name: 'verification_reviewed_at',
    type: 'timestamptz',
    nullable: true,
  })
  verificationReviewedAt: Date | null;

  @Column({
    name: 'last_latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  lastLatitude: number;

  @Column({
    name: 'last_longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  lastLongitude: number;

  @Column({ name: 'last_location_update', type: 'timestamp', nullable: true })
  lastLocationUpdate: Date;

  /** Instapay / wallet QR ops uses to pay this rider. */
  @Column({ name: 'payout_qr_file_id', type: 'int', nullable: true })
  payoutQrFileId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
