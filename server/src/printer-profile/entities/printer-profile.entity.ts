import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('printer_profiles')
export class PrinterProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  @Column({ name: 'build_volume_width_mm', type: 'int', default: 180 })
  buildVolumeWidthMm: number;

  @Column({ name: 'build_volume_depth_mm', type: 'int', default: 180 })
  buildVolumeDepthMm: number;

  @Column({ name: 'build_volume_height_mm', type: 'int', default: 180 })
  buildVolumeHeightMm: number;

  @Column({ name: 'max_file_size_mb', type: 'int', default: 200 })
  maxFileSizeMb: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
