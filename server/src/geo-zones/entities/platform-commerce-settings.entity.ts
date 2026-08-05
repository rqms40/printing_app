import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Single-row platform fee / commission defaults (id = 1).
 * Commission is basis points (1500 = 15%).
 */
@Entity('platform_commerce_settings')
export class PlatformCommerceSettings {
  @PrimaryColumn({ type: 'int' })
  id: number;

  /** Platform commission in basis points (1/100 of a percent). */
  @Column({ name: 'default_commission_bps', type: 'int', default: 1500 })
  defaultCommissionBps: number;

  /** Default delivery fee when no zone match (PHP centavos). */
  @Column({
    name: 'default_delivery_fee_minor',
    type: 'bigint',
    default: '2500',
  })
  defaultDeliveryFeeMinor: string;

  /**
   * When true and active geo zones exist, destinations outside all zones
   * are rejected (not classified as external).
   */
  @Column({ name: 'reject_outside_zones', default: true })
  rejectOutsideZones: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
