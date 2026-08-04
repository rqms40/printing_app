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

  /** Service zone codes / labels the supplier covers (e.g. Davao barangays). */
  @Column({ name: 'service_zones', type: 'jsonb', default: () => "'[]'" })
  serviceZones: string[];

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
