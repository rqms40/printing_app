import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DailyGridSpecValues = Record<string, unknown>;

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

  /** Product category slug, e.g. `paper` or `3d`. */
  @Column({ default: 'paper' })
  category: string;

  @Column({ default: 0 })
  sortOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  specs: DailyGridSpecValues | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
