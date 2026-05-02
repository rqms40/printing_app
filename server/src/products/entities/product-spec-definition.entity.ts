import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import {
  InputType,
  PricingRole,
  ValueType,
} from '../enums/catalog.enums';
import { ProductCategory } from './product-category.entity';
import { ProductSpecOption } from './product-spec-option.entity';

const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

@Entity('product_spec_definitions')
@Unique('uq_product_spec_key', ['categoryId', 'key'])
export class ProductSpecDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => ProductCategory, (category) => category.specs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: ProductCategory;

  @Column({ length: 50 })
  key: string;

  @Column({ length: 100 })
  label: string;

  @Column({ name: 'help_text', type: 'text', nullable: true })
  helpText: string | null;

  @Column({ name: 'input_type', type: 'varchar', length: 30 })
  inputType: InputType;

  @Column({ name: 'value_type', type: 'varchar', length: 30 })
  valueType: ValueType;

  @Column({ name: 'is_required', default: true })
  isRequired: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'default_value', type: 'varchar', length: 100, nullable: true })
  defaultValue: string | null;

  @Column({
    name: 'pricing_role',
    type: 'varchar',
    length: 40,
    default: PricingRole.NONE,
  })
  pricingRole: PricingRole;

  @Column({ name: 'unit_label', type: 'varchar', length: 20, nullable: true })
  unitLabel: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  placeholder: string | null;

  @Column({ name: 'min_value', type: 'decimal', precision: 10, scale: 3, nullable: true, transformer: decimalTransformer })
  minValue: number | null;

  @Column({ name: 'max_value', type: 'decimal', precision: 10, scale: 3, nullable: true, transformer: decimalTransformer })
  maxValue: number | null;

  @Column({ name: 'step_value', type: 'decimal', precision: 10, scale: 3, nullable: true, transformer: decimalTransformer })
  stepValue: number | null;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @OneToMany(() => ProductSpecOption, (option) => option.specDefinition)
  options: ProductSpecOption[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
