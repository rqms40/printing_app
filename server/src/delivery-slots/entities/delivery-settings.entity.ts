import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('delivery_settings')
export class DeliverySettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'service_center_lat',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  serviceCenterLat: number;

  @Column({
    name: 'service_center_lng',
    type: 'decimal',
    precision: 10,
    scale: 7,
  })
  serviceCenterLng: number;

  @Column({
    name: 'service_radius_km',
    type: 'decimal',
    precision: 6,
    scale: 2,
    default: 25,
  })
  serviceRadiusKm: number;

  @Column({
    name: 'priority_fee_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 50,
  })
  priorityFeeAmount: number;

  @Column({
    name: 'delivery_fee_per_km',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 50,
  })
  deliveryFeePerKm: number;

  @Column({
    name: 'extra_destination_surcharge',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 30,
  })
  extraDestinationSurcharge: number;

  /** Customer service fee as a percent of print subtotal (10 = 10%). */
  @Column({
    name: 'service_fee_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  serviceFeePercent: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
