// server/src/products/entities/service-category.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SpecOption } from './spec-option.entity';
import { ServiceAddon } from './service-addon.entity';

const numberTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : parseFloat(value)),
};

@Entity('service_categories')
export class ServiceCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @Column({
    name: 'base_rate',
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: numberTransformer,
  })
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
