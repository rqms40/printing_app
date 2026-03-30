import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity('paper_specs')
export class PaperSpec {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', unique: true })
  orderId: number;

  @OneToOne(() => Order, (o) => o.paperSpec)
  @JoinColumn({ name: 'order_id' })
  order: Order;

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
}
