import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum HomeFeedMode {
  AUTO = 'auto',
  COMMUNITY = 'community',
  PROMO = 'promo',
}

@Entity('home_feed_settings')
export class HomeFeedSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'enum',
    enum: HomeFeedMode,
    enumName: 'home_feed_settings_mode_enum',
    default: HomeFeedMode.AUTO,
  })
  mode: HomeFeedMode;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
