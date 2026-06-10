import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ProductSpecDefinition } from './product-spec-definition.entity';

const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

@Entity('product_spec_options')
@Unique('uq_product_spec_option_value', ['specDefinitionId', 'value'])
export class ProductSpecOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'spec_definition_id' })
  specDefinitionId: number;

  @ManyToOne(() => ProductSpecDefinition, (spec) => spec.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'spec_definition_id' })
  specDefinition: ProductSpecDefinition;

  @Column({ length: 100 })
  label: string;

  @Column({ length: 50 })
  value: string;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 3,
    default: 1,
    transformer: decimalTransformer,
  })
  multiplier: number;

  @Column({
    name: 'fixed_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  fixedFee: number;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  unitCost: number;

  @Column({
    name: 'estimated_quantity',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  estimatedQuantity: number | null;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
