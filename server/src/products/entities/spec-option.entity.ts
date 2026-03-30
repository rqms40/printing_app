// server/src/products/entities/spec-option.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Unique,
} from 'typeorm';
import { ServiceCategory } from './service-category.entity';

@Entity('spec_options')
@Unique('uq_spec_option', ['categoryId', 'optionGroup', 'value'])
export class SpecOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => ServiceCategory, (cat) => cat.specOptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory;

  // Column named 'option_group' to avoid SQL reserved word 'group'
  @Column({ name: 'option_group', length: 50 })
  optionGroup: string;

  @Column({ length: 100 })
  label: string;

  @Column({ length: 50 })
  value: string;

  @Column({ type: 'decimal', precision: 6, scale: 3, default: 1.0 })
  multiplier: number;

  @Column({ name: 'fixed_fee', type: 'decimal', precision: 10, scale: 2, default: 0 })
  fixedFee: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitCost: number;

  @Column({ name: 'estimated_grams', type: 'int', nullable: true })
  estimatedGrams: number;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
