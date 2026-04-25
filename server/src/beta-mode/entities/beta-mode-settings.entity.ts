import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('beta_mode_settings')
export class BetaModeSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'is_enabled', default: false })
  isEnabled: boolean;
}
