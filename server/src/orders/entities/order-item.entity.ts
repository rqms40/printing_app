import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { DeliveryDestination } from './delivery-destination.entity';
import { OrderItemSpecValue } from './order-item-spec-value.entity';
import type { PaperSpec } from './paper-specs.entity';
import type { ThreeDSpec } from './three-d-specs.entity';

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

  @Column({ name: 'category_id', type: 'int', nullable: true })
  categoryId: number | null;

  @Column({
    name: 'category_slug',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  categorySlug: string | null;

  @Column({
    name: 'category_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  categoryName: string | null;

  @Column({
    name: 'pricing_model',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  pricingModel: string | null;

  @Column({ name: 'file_url', nullable: true })
  fileUrl: string;

  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @Column({ name: 'file_metadata_id', nullable: true, type: 'int' })
  fileMetadataId: number | null;

  @Column({ name: 'special_instructions', type: 'text', nullable: true })
  specialInstructions: string | null;

  @Column({ name: 'required_at', type: 'timestamptz', nullable: true })
  requiredAt: Date | null;

  @Column({ name: 'destination_id', type: 'int', nullable: true })
  destinationId: number | null;

  @ManyToOne(() => DeliveryDestination, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'destination_id' })
  destination: DeliveryDestination | null;

  @Column({ default: 1 })
  quantity: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @OneToMany(() => OrderItemSpecValue, (value) => value.orderItem)
  specValues: OrderItemSpecValue[];

  paperSpec?: PaperSpec | null;
  threeDSpec?: ThreeDSpec | null;
}
