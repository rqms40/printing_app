import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { SupplierProfile } from './supplier-profile.entity';

export type CatalogAddonOffer = {
  name: string;
  price: number;
  priceType: 'flat' | 'per_unit';
};

@Entity('supplier_catalog_offerings')
@Unique('uq_supplier_catalog_offering_title', ['supplierId', 'title'])
@Index('idx_supplier_catalog_offerings_supplier_id', ['supplierId'])
export class SupplierCatalogOffering {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'supplier_id' })
  supplierId: number;

  @ManyToOne(() => SupplierProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: SupplierProfile;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  /** Product category slugs this offering covers (leaf variants). */
  @Column({ name: 'category_slugs', type: 'jsonb', default: () => "'[]'" })
  categorySlugs: string[];

  /**
   * Spec key → allowed option values the shop can fulfill.
   * Example: { printer: ['eco_solvent','uv'], size: ['2x4','4x3'] }
   */
  @Column({ name: 'spec_options', type: 'jsonb', default: () => "'{}'" })
  specOptions: Record<string, string[]>;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  addons: CatalogAddonOffer[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  notes: string[];

  @Column({
    name: 'base_rate_pesos',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  baseRatePesos: number | null;

  @Column({ name: 'pricing_unit', type: 'varchar', length: 40, nullable: true })
  pricingUnit: string | null;

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  source: 'manual' | 'import';

  @Column({ name: 'source_file_name', type: 'varchar', length: 255, nullable: true })
  sourceFileName: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
