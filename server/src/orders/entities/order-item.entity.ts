import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { PaperSpec } from './paper-specs.entity';
import { ThreeDSpec } from './three-d-specs.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column()
  category: string;

  @Column({ name: 'file_url', nullable: true })
  fileUrl: string;

  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @Column({ name: 'file_metadata_id', nullable: true, type: 'int' })
  fileMetadataId: number | null;

  @Column({ default: 1 })
  quantity: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @OneToOne(() => PaperSpec, (spec) => spec.orderItem, { nullable: true })
  paperSpec: PaperSpec | null;

  @OneToOne(() => ThreeDSpec, (spec) => spec.orderItem, { nullable: true })
  threeDSpec: ThreeDSpec | null;
}
