import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/** GeoJSON Polygon: coordinates are rings of [lng, lat] pairs. */
export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][];
};

@Entity('geo_zones')
@Index('idx_geo_zones_is_active', ['isActive'])
export class GeoZone {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  code: string;

  /** Closed-ring GeoJSON polygon (simplified pilot zones). */
  @Column({ type: 'jsonb' })
  polygon: GeoJsonPolygon;

  /** Zone-specific base delivery fee in PHP centavos. */
  @Column({
    name: 'base_delivery_fee_minor',
    type: 'bigint',
    default: '2500',
  })
  baseDeliveryFeeMinor: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
