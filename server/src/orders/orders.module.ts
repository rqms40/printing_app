import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Order } from './entities/order.entity';
import { BatchOrder } from './entities/batch-order.entity';
import { PaperSpec } from './entities/paper-specs.entity';
import { ThreeDSpec } from './entities/three-d-specs.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrderItem } from './entities/order-item.entity';
import { DeliveryDestination } from './entities/delivery-destination.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ExternalDeliveriesController } from './external-deliveries.controller';
import { OrdersGateway } from './orders.gateway';
import { UsersModule } from '../users/users.module';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';
import { DeliveryAssignment } from '../drivers/entities/delivery-assignment.entity';
import { Address } from '../addresses/entities/address.entity';
import { DeliverySlotsModule } from '../delivery-slots/delivery-slots.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      BatchOrder,
      PaperSpec,
      ThreeDSpec,
      OrderStatusHistory,
      OrderItem,
      DeliveryAssignment,
      Address,
      DeliveryDestination,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '7d') },
      }),
    }),
    UsersModule,
    CreditsModule,
    NotificationsModule,
    FilesModule,
    DeliverySlotsModule,
  ],
  providers: [OrdersService, OrdersGateway],
  controllers: [OrdersController, ExternalDeliveriesController],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
