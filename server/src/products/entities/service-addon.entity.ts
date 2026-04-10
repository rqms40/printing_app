// server/src/products/entities/service-addon.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ServiceCategory } from './service-category.entity';

const numberTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : parseFloat(value)),
};

@Entity('service_addons')
export class ServiceAddon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId: number | null;

  @ManyToOne(() => ServiceCategory, (cat) => cat.addons, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory | null;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numberTransformer,
  })
  price: number;

  @Column({ name: 'price_type', length: 20 })
  priceType: string; // 'flat' | 'per_unit'

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
