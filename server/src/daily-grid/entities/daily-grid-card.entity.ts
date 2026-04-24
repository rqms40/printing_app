import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('daily_grid_cards')
export class DailyGridCard {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true, type: 'varchar' })
  subtitle: string | null;

  @Column({ nullable: true, type: 'varchar' })
  imageUrl: string | null;

  /** 'paper' | '3d' — matches OrderFlowState.category */
  @Column({ default: 'paper' })
  category: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ name: 'paper_specs', type: 'jsonb', nullable: true })
  paperSpecs: {
    paperSize?: string;
    colorMode?: string;
    mediaType?: string;
    printSides?: string;
    binding?: string;
  } | null;

  @Column({ name: 'three_d_specs', type: 'jsonb', nullable: true })
  threeDSpecs: {
    fileFormat?: string;
    material?: string;
    color?: string;
    infillPercentage?: number;
    layerHeight?: number;
    supports?: boolean;
    notes?: string;
  } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
