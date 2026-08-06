import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { SupplierCapability } from './supplier-capability.entity';
import { SupplierVerification } from './supplier-verification.entity';

@Entity('supplier_profiles')
@Index('idx_supplier_profiles_user_id', ['userId'], { unique: true })
export class SupplierProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'business_name', type: 'varchar', length: 200 })
  businessName: string;

  /** Public description / about the shop. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 40, nullable: true })
  contactPhone: string | null;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contactEmail: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  /** Profile picture / logo file metadata id. */
  @Column({ name: 'logo_file_id', type: 'int', nullable: true })
  logoFileId: number | null;

  /**
   * Free-form supplier attributes (equipment, finishes, languages, etc.).
   * Map of string key → string value for simple UI editing.
   */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  attributes: Record<string, string>;

  /** Service zone codes / labels the supplier covers (e.g. Davao barangays). */
  @Column({ name: 'service_zones', type: 'jsonb', default: () => "'[]'" })
  serviceZones: string[];

  /**
   * Ordered service-focus keys (priority rank). Index 0 = primary focus.
   * Catalog keys: signages, tarpaulins, document_printing, apparel, etc.
   */
  @Column({ name: 'service_focus_ranks', type: 'jsonb', default: () => "'[]'" })
  serviceFocusRanks: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** Placeholder aggregate rating (0–5). Filled by later feedback work. */
  @Column({
    name: 'rating_average',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
  })
  ratingAverage: number;

  /** Placeholder count of ratings. */
  @Column({ name: 'rating_count', type: 'int', default: 0 })
  ratingCount: number;

  @OneToMany(() => SupplierCapability, (capability) => capability.supplier)
  capabilities: SupplierCapability[];

  @OneToOne(() => SupplierVerification, (verification) => verification.supplier)
  verification: SupplierVerification;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
