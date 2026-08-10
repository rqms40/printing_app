import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SupplierProfile } from './supplier-profile.entity';

export enum SupplierVerificationStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

@Entity('supplier_verifications')
@Index('idx_supplier_verifications_supplier_id', ['supplierId'], {
  unique: true,
})
export class SupplierVerification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id', unique: true })
  supplierId: number;

  @OneToOne(() => SupplierProfile, (profile) => profile.verification, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: SupplierProfile;

  @Column({
    type: 'enum',
    enum: SupplierVerificationStatus,
    default: SupplierVerificationStatus.PENDING,
  })
  status: SupplierVerificationStatus;

  /**
   * Opaque reference to payout details stored outside this row
   * (e.g. secure vault key). Never store raw bank/account secrets here.
   */
  @Column({
    name: 'payout_details_ref',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  payoutDetailsRef: string | null;

  @Column({ name: 'reviewed_by', type: 'int', nullable: true })
  reviewedBy: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by' })
  reviewer: User | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
