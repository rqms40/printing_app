import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('three_d_specs')
export class ThreeDSpec {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', unique: true })
  orderId: number;

  @OneToOne(() => Order)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'file_format', length: 10 })
  fileFormat: string;

  @Column({ length: 10 })
  material: string;

  @Column({ length: 50 })
  color: string;

  @Column({ name: 'infill_percentage' })
  infillPercentage: number;

  @Column({ name: 'layer_height', type: 'decimal', precision: 3, scale: 2 })
  layerHeight: number;

  @Column({ default: false })
  supports: boolean;

  @Column({ nullable: true, type: 'text' })
  notes: string;
}
