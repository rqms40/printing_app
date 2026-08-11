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
import { Address } from '../../addresses/entities/address.entity';
import { OrderStatusHistory } from './order-status-history.entity';
import { BatchOrder } from './batch-order.entity';
import { OrderItem } from './order-item.entity';
import { DeliveryDestination } from './delivery-destination.entity';
import type { PaperSpec } from './paper-specs.entity';
import type { ThreeDSpec } from './three-d-specs.entity';

/**
 * Marketplace order lifecycle (API: snake_case string values).
 * Legacy shop-queue labels are migrated in 1784333200000-marketplace-order-status.
 */
export enum OrderStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  NEEDS_QA = 'needs_qa',
  CLIENT_CORRECTION = 'client_correction',
  PROOF_APPROVAL = 'proof_approval',
  APPROVED_FOR_MATCHING = 'approved_for_matching',
  SUPPLIER_ASSIGNED = 'supplier_assigned',
  SUPPLIER_ACCEPTED = 'supplier_accepted',
  AWAITING_PAYMENT = 'awaiting_payment',
  PAYMENT_AUTHORIZED = 'payment_authorized',
  PRODUCTION = 'production',
  SUPPLIER_SELF_QC = 'supplier_self_qc',
  READY_FOR_DISPATCH = 'ready_for_dispatch',
  RIDER_ASSIGNED = 'rider_assigned',
  PICKED_UP = 'picked_up',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  /** Failed delivery with evidence; awaiting return / paid redelivery. */
  DELIVERY_FAILED = 'delivery_failed',
  COLLECTED_BY_CUSTOMER = 'collected_by_customer',
  ISSUE_WINDOW_OPEN = 'issue_window_open',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FILE_REJECTED = 'file_rejected',
}

/**
 * Marketplace payment methods (PRD §7.6 / decisions §4).
 * Column remains free-form string for legacy values (gridCredits, gcash, …);
 * pilot paths should write these labels. Eligibility rules are Phase 3.
 */
export enum MarketplacePaymentMethod {
  PILOT_CREDIT = 'pilot_credit',
  COD = 'cod',
  PAYMONGO = 'paymongo',
  /** Manual QR Ph / InstaPay with receipt verification by ops. */
  QR_PH_INSTAPAY = 'qr_ph_instapay',
}

/** Payment authorization gate status (production requires authorized). */
export enum PaymentAuthorizationStatus {
  NONE = 'none',
  AUTHORIZED = 'authorized',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

/** RFQ pricing state, independent of production payment authorization. */
export enum PricingStatus {
  PENDING_QUOTE = 'pending_quote',
  QUOTED = 'quoted',
  ACCEPTED = 'accepted',
}

/**
 * Immutable commercial snapshot frozen at `payment_authorized`.
 * Money fields are PHP minor units (centavos) as decimal strings.
 *
 * Note: entity column is typed as a plain object for TypeORM
 * `_QueryDeepPartialEntity` compatibility; application code should treat
 * values as this shape via helpers in `order-authorization-snapshot.ts`.
 */
export type OrderAuthorizationSnapshot = {
  frozenAt: string;
  priceMinor: string;
  deliveryFeeMinor: string;
  feesMinor: string;
  commissionMinor: string;
  finalTotalMinor: string;
  paymentMethod: string | null;
  specs: Record<string, unknown> | null;
  artworkVersion: string | number | null;
  promisedDate: string | null;
};

@Entity('orders')
@Index('idx_orders_user_id', ['userId'])
@Index('idx_orders_status', ['orderStatus'])
@Index('idx_orders_pricing_status', ['pricingStatus'])
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', unique: true })
  orderId: string;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'batch_order_id', nullable: true })
  batchOrderId: number;

  @Column({ name: 'destination_id', type: 'int', nullable: true })
  destinationId: number | null;

  @ManyToOne(() => DeliveryDestination, { nullable: true })
  @JoinColumn({ name: 'destination_id' })
  destination: DeliveryDestination | null;

  @ManyToOne(() => BatchOrder, (batchOrder) => batchOrder.orders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'batch_order_id' })
  batchOrder: BatchOrder;

  @Column()
  category: string;

  @Column({ name: 'file_url', nullable: true })
  fileUrl: string;

  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @Column({ name: 'file_metadata_id', nullable: true, type: 'int' })
  fileMetadataId: number | null;

  @Column({ default: 1 })
  quantity: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({
    name: 'delivery_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  deliveryFee: number;

  /**
   * Final commercial total in PHP minor units (centavos).
   * Prefer this over legacy `totalPrice` + `deliveryFee` majors for marketplace.
   */
  @Column({ name: 'final_total_minor', type: 'bigint', nullable: true })
  finalTotalMinor: string | null;

  /** Delivery fee in PHP minor units (centavos). */
  @Column({ name: 'delivery_fee_minor', type: 'bigint', nullable: true })
  deliveryFeeMinor: string | null;

  /**
   * Final customer quote in PHP minor units, including authoritative delivery.
   * SupplierAssignment.finalPriceMinor remains the goods-only supplier quote.
   */
  @Column({ name: 'quoted_total_minor', type: 'bigint', nullable: true })
  quotedTotalMinor: string | null;

  @Column({ name: 'quoted_at', type: 'timestamptz', nullable: true })
  quotedAt: Date | null;

  @Column({ name: 'quote_accepted_at', type: 'timestamptz', nullable: true })
  quoteAcceptedAt: Date | null;

  @Column({ name: 'quoted_by_user_id', type: 'int', nullable: true })
  quotedByUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'quoted_by_user_id' })
  quotedByUser: User | null;

  @Column({
    name: 'promised_completion_at',
    type: 'timestamptz',
    nullable: true,
  })
  promisedCompletionAt: Date | null;

  @Column({
    name: 'pricing_status',
    type: 'enum',
    enum: PricingStatus,
    enumName: 'orders_pricing_status_enum',
    default: PricingStatus.ACCEPTED,
  })
  pricingStatus: PricingStatus;

  /**
   * Payment rail label. Legacy: gridCredits / gcash / maya / cash / cod.
   * Marketplace: pilot_credit | cod | paymongo (see MarketplacePaymentMethod).
   */
  @Column({ name: 'payment_method' })
  paymentMethod: string;

  @Column({ name: 'payment_status', default: 'pending' })
  paymentStatus: string;

  /**
   * Authorization gate independent of cash collection / ledger settlement.
   * COD cash collection ≠ authorization (PRD §7.6).
   */
  @Column({
    name: 'payment_authorization_status',
    type: 'enum',
    enum: PaymentAuthorizationStatus,
    enumName: 'orders_payment_authorization_status_enum',
    default: PaymentAuthorizationStatus.NONE,
  })
  paymentAuthorizationStatus: PaymentAuthorizationStatus;

  /**
   * COD eligibility flag (scaffold). Business rules (cap ≤ ₱1,500, etc.)
   * land in Phase 3 — default false until payments module evaluates.
   */
  @Column({ name: 'cod_eligible', type: 'boolean', default: false })
  codEligible: boolean;

  /**
   * Immutable commercial snapshot at payment_authorized:
   * price, fees, commission, specs, artwork version, promised date.
   * Once set, must not be rewritten (see freezeAuthorizationSnapshot helpers).
   * Stored as jsonb; runtime shape is OrderAuthorizationSnapshot.
   * Typed as plain object for TypeORM deep-partial update compatibility.
   */
  @Column({
    name: 'authorization_snapshot',
    type: 'jsonb',
    nullable: true,
  })
  authorizationSnapshot: object | null;

  @Column({
    name: 'order_status',
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.SUBMITTED,
  })
  orderStatus: OrderStatus;

  @Column({ name: 'delivery_option', default: 'pickup' })
  deliveryOption: string;

  @Column({
    name: 'admin_status_note',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  adminStatusNote: string | null;

  @Column({
    name: 'estimated_completion_at',
    type: 'timestamp',
    nullable: true,
  })
  estimatedCompletionAt: Date | null;

  @Column({ name: 'admin_status_set_at', type: 'timestamp', nullable: true })
  adminStatusSetAt: Date | null;

  @Column({ name: 'decline_reason', nullable: true, type: 'text' })
  declineReason: string;

  @Column({ name: 'cancellation_reason', nullable: true, type: 'text' })
  cancellationReason: string;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'delivery_address_id', nullable: true })
  deliveryAddressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'delivery_address_id' })
  deliveryAddress: Address;

  @Column({ name: 'assigned_rider_id', nullable: true })
  assignedRiderId: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_rider_id' })
  assignedRider: User | null;

  @Column({ name: 'admin_notes', nullable: true, type: 'text' })
  adminNotes: string;

  @Column({ name: 'tracking_link', nullable: true, type: 'text' })
  trackingLink: string;

  /**
   * Material issue window end (delivery proof + 24h). Set when entering
   * `issue_window_open`. Null when window never opened.
   */
  @Column({ name: 'issue_window_ends_at', type: 'timestamptz', nullable: true })
  issueWindowEndsAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => OrderStatusHistory, (h) => h.order)
  statusHistory: OrderStatusHistory[];

  @OneToMany(() => OrderItem, (item) => item.order)
  items: OrderItem[];

  paperSpec?: PaperSpec | null;
  threeDSpec?: ThreeDSpec | null;
}
