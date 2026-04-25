import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Address } from '../../addresses/entities/address.entity';
import { Order } from './order.entity';

@Entity('batch_orders')
export class BatchOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'batch_ref', unique: true })
  batchRef: string;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({
    name: 'delivery_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  deliveryFee: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ name: 'payment_method' })
  paymentMethod: string;

  @Column({ name: 'payment_status', default: 'pending' })
  paymentStatus: string;

  @Column({ name: 'delivery_option', default: 'pickup' })
  deliveryOption: string;

  @Column({ name: 'delivery_address_id', nullable: true })
  deliveryAddressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'delivery_address_id' })
  deliveryAddress: Address;

  @OneToMany(() => Order, (order) => order.batchOrder)
  orders: Order[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
