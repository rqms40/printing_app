import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverProfile } from './entities/driver-profile.entity';
import { DeliveryAssignment } from './entities/delivery-assignment.entity';
import { Order } from '../orders/entities/order.entity';
import { DriversService } from './drivers.service';
import { DriversController } from './drivers.controller';
import { LocationGateway } from './location.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([DriverProfile, DeliveryAssignment, Order]),
  ],
  controllers: [DriversController],
  providers: [DriversService, LocationGateway],
  exports: [DriversService, LocationGateway],
})
export class DriversModule {}
