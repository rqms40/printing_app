import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { SupplierProfile } from './supplier-profile.entity';

@Entity('supplier_capabilities')
@Index('idx_supplier_capabilities_supplier_id', ['supplierId'])
@Unique('uq_supplier_capability_product', ['supplierId', 'productFamily'])
export class SupplierCapability {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @ManyToOne(() => SupplierProfile, (profile) => profile.capabilities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: SupplierProfile;

  /** Normalized active orderable RFQ leaf slug (for example, flyers). */
  @Column({ name: 'product_family', type: 'varchar', length: 80 })
  productFamily: string;

  /** Materials this capability covers (e.g. glossy, matte, tarpaulin). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  materials: string[];

  /** Max concurrent / daily capacity units for this family (policy-defined). */
  @Column({ name: 'max_capacity', type: 'int', default: 0 })
  maxCapacity: number;

  /** Typical lead time in working days. */
  @Column({ name: 'lead_time_days', type: 'int', default: 1 })
  leadTimeDays: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
