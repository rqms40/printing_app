import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { OrderItem } from './order-item.entity';

const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

@Entity('order_item_spec_values')
export class OrderItemSpecValue {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_item_id' })
  orderItemId: number;

  @ManyToOne(() => OrderItem, (item) => item.specValues, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ name: 'spec_definition_id', type: 'int', nullable: true })
  specDefinitionId: number | null;

  @Column({ name: 'spec_key', length: 50 })
  specKey: string;

  @Column({ name: 'spec_label', length: 100 })
  specLabel: string;

  @Column({ name: 'input_type', length: 30 })
  inputType: string;

  @Column({ length: 120 })
  value: string;

  @Column({ name: 'display_value', length: 120 })
  displayValue: string;

  @Column({ name: 'option_id', type: 'int', nullable: true })
  optionId: number | null;

  @Column({
    name: 'option_label',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  optionLabel: string | null;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 3,
    default: 1,
    transformer: decimalTransformer,
  })
  multiplier: number;

  @Column({
    name: 'fixed_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  fixedFee: number;

  @Column({
    name: 'unit_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  unitCost: number;

  @Column({
    name: 'estimated_quantity',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  estimatedQuantity: number | null;
}
