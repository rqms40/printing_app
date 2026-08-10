import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { FileProcessingType, PricingModel } from '../enums/catalog.enums';
import { ProductSpecDefinition } from './product-spec-definition.entity';
import { ServiceAddon } from './service-addon.entity';

const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

@Entity('product_categories')
export class ProductCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'mobile_description',
    type: 'varchar',
    length: 160,
    nullable: true,
  })
  mobileDescription: string | null;

  /** e.g. "Best for: Businesses, startups, and events…" */
  @Column({
    name: 'audience_label',
    type: 'varchar',
    length: 240,
    nullable: true,
  })
  audienceLabel: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  /**
   * Self-referential parent for Category → Subgroup → Variant.
   * Null for top-level roots (including legacy paper/3d).
   */
  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne(() => ProductCategory, (category) => category.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: ProductCategory | null;

  @OneToMany(() => ProductCategory, (category) => category.parent)
  children: ProductCategory[];

  /**
   * 1 = top category, 2 = subgroup, 3 = variant / leaf product.
   * Legacy paper/3d remain level 1 orderable roots.
   */
  @Column({ name: 'catalog_level', type: 'smallint', default: 1 })
  catalogLevel: number;

  /**
   * Only orderable nodes accept checkout / pricing.
   * Hierarchy parents (categories & subgroups) are browse-only.
   */
  @Column({ name: 'is_orderable', default: true })
  isOrderable: boolean;

  @Column({
    name: 'file_processing_type',
    type: 'varchar',
    length: 30,
    default: FileProcessingType.GENERIC_FILE,
  })
  fileProcessingType: FileProcessingType;

  @Column({
    name: 'pricing_model',
    type: 'varchar',
    length: 50,
  })
  pricingModel: PricingModel;

  @Column({
    name: 'base_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  baseRate: number;

  @Column({ name: 'quantity_unit', length: 30, default: 'copy' })
  quantityUnit: string;

  @Column({ name: 'max_file_size_mb', default: 50 })
  maxFileSizeMb: number;

  @Column({
    name: 'allowed_extensions',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  allowedExtensions: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => ProductSpecDefinition, (spec) => spec.category)
  specs: ProductSpecDefinition[];

  @OneToMany(() => ServiceAddon, (addon) => addon.category)
  addons: ServiceAddon[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
