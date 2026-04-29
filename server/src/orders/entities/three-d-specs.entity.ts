import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';

@Entity('three_d_specs')
export class ThreeDSpec {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @OneToOne(() => Order, (o) => o.threeDSpec)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_item_id', nullable: true })
  orderItemId: number | null;

  @OneToOne(() => OrderItem, (item) => item.threeDSpec, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem | null;

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
