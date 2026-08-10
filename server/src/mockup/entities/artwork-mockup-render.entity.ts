import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FileMetadata } from '../../files/entities/file-metadata.entity';
import { Order } from '../../orders/entities/order.entity';

/** Static Product Preview lifecycle (non-production). */
export enum MockupRenderStatus {
  PENDING = 'pending',
  READY = 'ready',
  INVALIDATED = 'invalidated',
  FAILED = 'failed',
}

/**
 * ArtworkMockupRender — Product Preview only (PRD §9.1 / A11).
 * Never a production source. Static template composites are versioned and
 * flagged non-production until a full renderer lands.
 */
@Entity('artwork_mockup_renders')
@Index('idx_mockup_artwork_file_id', ['artworkFileId'])
@Index('idx_mockup_order_id', ['orderId'])
@Index('idx_mockup_product_type', ['productType'])
export class ArtworkMockupRender {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'artwork_file_id', type: 'int' })
  artworkFileId: number;

  @ManyToOne(() => FileMetadata)
  @JoinColumn({ name: 'artwork_file_id' })
  artworkFile: FileMetadata;

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  /** flyer | tarpaulin | signage | t-shirt | other */
  @Column({ name: 'product_type', type: 'varchar', length: 40 })
  productType: string;

  /** Template composite version (e.g. flyer-v1). */
  @Column({ name: 'template_version', type: 'varchar', length: 40 })
  templateVersion: string;

  @Column({
    name: 'render_status',
    type: 'enum',
    enum: MockupRenderStatus,
    enumName: 'artwork_mockup_renders_status_enum',
    default: MockupRenderStatus.PENDING,
  })
  renderStatus: MockupRenderStatus;

  /** Signed or static preview URL — never production artwork. */
  @Column({ name: 'render_url', type: 'text', nullable: true })
  renderUrl: string | null;

  /** Always true for this MVP (static templates). */
  @Column({ name: 'is_non_production', type: 'boolean', default: true })
  isNonProduction: boolean;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'invalidated_at', type: 'timestamptz', nullable: true })
  invalidatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
