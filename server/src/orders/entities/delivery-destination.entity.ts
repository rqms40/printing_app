import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Address } from '../../addresses/entities/address.entity';

@Entity('delivery_destinations')
@Index('idx_destination_batch', ['batchOrderId'])
export class DeliveryDestination {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'batch_order_id', type: 'int' })
  batchOrderId: number;

  @Column({ name: 'address_id', type: 'int' })
  addressId: number;

  @ManyToOne(() => Address)
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
