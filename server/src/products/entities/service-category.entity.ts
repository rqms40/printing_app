// server/src/products/entities/service-category.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { SpecOption } from './spec-option.entity';
import { ServiceAddon } from './service-addon.entity';

@Entity('service_categories')
export class ServiceCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 50, nullable: true })
  icon: string;

  @Column({ name: 'base_rate', type: 'decimal', precision: 10, scale: 2 })
  baseRate: number;

  @Column({ name: 'max_file_size_mb', default: 50 })
  maxFileSizeMb: number;

  @Column({ name: 'allowed_extensions', type: 'text' })
  allowedExtensions: string; // stored as JSON string e.g. '["pdf","png"]'

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => SpecOption, (opt) => opt.category)
  specOptions: SpecOption[];

  @OneToMany(() => ServiceAddon, (addon) => addon.category)
  addons: ServiceAddon[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
