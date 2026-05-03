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

  @Column({ name: 'address_id', type: 'int', nullable: true })
  addressId: number | null;

  @ManyToOne(() => Address, { nullable: true })
  @JoinColumn({ name: 'address_id' })
  address: Address | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'full_address', type: 'text', nullable: true })
  fullAddress: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  barangay: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province: string | null;

  @Column({ name: 'zip_code', type: 'varchar', length: 10, nullable: true })
  zipCode: string | null;

  @Column({ type: 'text', nullable: true })
  landmark: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;
}
