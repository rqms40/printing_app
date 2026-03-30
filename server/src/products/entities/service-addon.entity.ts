// server/src/products/entities/service-addon.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { ServiceCategory } from './service-category.entity';

@Entity('service_addons')
export class ServiceAddon {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_id', nullable: true })
  categoryId: number;

  @ManyToOne(() => ServiceCategory, (cat) => cat.addons, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'category_id' })
  category: ServiceCategory;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
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
