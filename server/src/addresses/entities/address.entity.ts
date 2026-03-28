import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('addresses')
@Index('idx_addresses_user_id', ['userId'])
export class Address {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 50 })
  label: string;

  @Column({ name: 'full_address', type: 'text' })
  fullAddress: string;

  @Column({ nullable: true, length: 100 })
  barangay: string;

  @Column({ length: 100 })
  city: string;

  @Column({ nullable: true, length: 100 })
  province: string;

  @Column({ name: 'zip_code', nullable: true, length: 10 })
  zipCode: string;

  @Column({ nullable: true, type: 'text' })
  landmark: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
