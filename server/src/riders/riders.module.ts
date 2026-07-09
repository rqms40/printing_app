import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiderProfile } from './entities/rider-profile.entity';
import { DeliveryAssignment } from './entities/delivery-assignment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersModule } from '../orders/orders.module';
import { RidersService } from './riders.service';
import { RidersController } from './riders.controller';
import { LocationGateway } from './location.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([RiderProfile, DeliveryAssignment, Order]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '7d') },
      }),
    }),
    OrdersModule,
  ],
  controllers: [RidersController],
  providers: [RidersService, LocationGateway],
  exports: [RidersService, LocationGateway],
})
export class RidersModule {}
