import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { PrintMode } from '../print-mode.enum';

@Entity('paper_specs')
export class PaperSpec {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', nullable: true })
  orderId: number | null;

  @OneToOne(() => Order, (o) => o.paperSpec)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_item_id', nullable: true })
  orderItemId: number | null;

  @OneToOne(() => OrderItem, (item) => item.paperSpec, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem | null;

  @Column({ name: 'paper_size', length: 20 })
  paperSize: string;

  @Column({ name: 'color_mode', length: 20 })
  colorMode: string;

  @Column({ name: 'media_type', length: 20 })
  mediaType: string;

  @Column({ name: 'print_sides', length: 20 })
  printSides: string;

  @Column({ length: 30, default: 'none' })
  binding: string;

  @Column({ name: 'print_mode', type: 'varchar', length: 20, nullable: true, default: 'fitToPage' })
  printMode: PrintMode | null;
}
