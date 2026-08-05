import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RiderProfile } from './rider-profile.entity';
import { Order } from '../../orders/entities/order.entity';

export enum DeliveryStatus {
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  PICKED_UP = 'picked_up',
  ON_THE_WAY = 'on_the_way',
  ARRIVED = 'arrived',
  DELIVERED = 'delivered',
}

export enum ProofOfDeliveryType {
  PHOTO = 'photo',
  SIGNATURE = 'signature',
}

@Entity('delivery_assignments')
@Index('idx_delivery_assignments_order', ['orderId'])
@Index('uq_delivery_assignments_current_order', ['orderId'], {
  unique: true,
  where: '"is_current" = true',
})
@Index('idx_delivery_assignments_rider', ['riderId'])
@Index('idx_delivery_assignments_status', ['status'])
export class DeliveryAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'rider_id' })
  riderId: number;

  @Column({ name: 'is_current', default: true })
  isCurrent: boolean;

  @ManyToOne(() => RiderProfile)
  @JoinColumn({ name: 'rider_id' })
  rider: RiderProfile;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.ASSIGNED,
  })
  status: DeliveryStatus;

  @Column({ name: 'assigned_at', type: 'timestamp', default: () => 'NOW()' })
  assignedAt: Date;

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date;

  @Column({ name: 'picked_up_at', type: 'timestamp', nullable: true })
  pickedUpAt: Date;

  @Column({ name: 'on_the_way_at', type: 'timestamp', nullable: true })
  onTheWayAt: Date;

  @Column({ name: 'arrived_at', type: 'timestamp', nullable: true })
  arrivedAt: Date;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({
    name: 'proof_type',
    type: 'enum',
    enum: ProofOfDeliveryType,
    enumName: 'delivery_proof_type_enum',
    nullable: true,
  })
  proofType: ProofOfDeliveryType | null;

  @Column({ name: 'proof_file_id', type: 'int', nullable: true })
  proofFileId: number | null;

  @Column({ name: 'proof_object_key', type: 'varchar', nullable: true })
  proofObjectKey: string | null;

  @Column({ name: 'proof_signature_data', type: 'text', nullable: true })
  proofSignatureData: string | null;

  @Column({ name: 'proof_captured_at', type: 'timestamp', nullable: true })
  proofCapturedAt: Date | null;

  @Column({ name: 'proof_captured_by_rider_id', type: 'int', nullable: true })
  proofCapturedByRiderId: number | null;

  /** SHA-256 hex of pickup OTP. Never return to clients. */
  @Column({ name: 'pickup_otp_hash', type: 'varchar', length: 64, nullable: true })
  pickupOtpHash: string | null;

  /**
   * Plain pickup OTP for supplier/ops reveal only.
   * Stripped from rider API responses.
   */
  @Column({ name: 'pickup_otp_code', type: 'varchar', length: 8, nullable: true })
  pickupOtpCode: string | null;

  @Column({ name: 'pickup_otp_verified_at', type: 'timestamp', nullable: true })
  pickupOtpVerifiedAt: Date | null;

  /** SHA-256 hex of delivery OTP. Never return to clients. */
  @Column({
    name: 'delivery_otp_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  deliveryOtpHash: string | null;

  /**
   * Plain delivery OTP for customer/ops reveal only.
   * Stripped from rider API responses.
   */
  @Column({
    name: 'delivery_otp_code',
    type: 'varchar',
    length: 8,
    nullable: true,
  })
  deliveryOtpCode: string | null;

  @Column({
    name: 'delivery_otp_verified_at',
    type: 'timestamp',
    nullable: true,
  })
  deliveryOtpVerifiedAt: Date | null;

  @Column({ name: 'pickup_proof_file_id', type: 'int', nullable: true })
  pickupProofFileId: number | null;

  @Column({ name: 'pickup_proof_object_key', type: 'varchar', nullable: true })
  pickupProofObjectKey: string | null;

  @Column({ name: 'pickup_proof_signature_data', type: 'text', nullable: true })
  pickupProofSignatureData: string | null;

  @Column({ name: 'pickup_proof_captured_at', type: 'timestamp', nullable: true })
  pickupProofCapturedAt: Date | null;

  @Column({ name: 'decline_reason', nullable: true, type: 'text' })
  declineReason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
