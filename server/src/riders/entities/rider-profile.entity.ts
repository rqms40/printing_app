import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('rider_profiles')
export class RiderProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'vehicle_type', length: 20 })
  vehicleType: string;

  @Column({ name: 'plate_number', nullable: true, length: 20 })
  plateNumber: string;

  @Column({ name: 'license_number', nullable: true, length: 50 })
  licenseNumber: string;

  @Column({ name: 'is_available', default: false })
  isAvailable: boolean;

  @Column({
    name: 'last_latitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  lastLatitude: number;

  @Column({
    name: 'last_longitude',
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  lastLongitude: number;

  @Column({ name: 'last_location_update', type: 'timestamp', nullable: true })
  lastLocationUpdate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
