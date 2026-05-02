import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Order } from './entities/order.entity';
import { BatchOrder } from './entities/batch-order.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemSpecValue } from './entities/order-item-spec-value.entity';
import { DeliveryDestination } from './entities/delivery-destination.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ExternalDeliveriesController } from './external-deliveries.controller';
import { OrdersGateway } from './orders.gateway';
import { UsersModule } from '../users/users.module';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { DeliveryAssignment } from '../drivers/entities/delivery-assignment.entity';
import { Address } from '../addresses/entities/address.entity';
import { DeliverySlotsModule } from '../delivery-slots/delivery-slots.module';
import { PrinterProfileModule } from '../printer-profile/printer-profile.module';
import { TamSurveysModule } from '../tam-surveys/tam-surveys.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      BatchOrder,
      OrderStatusHistory,
      OrderItem,
      OrderItemSpecValue,
      DeliveryAssignment,
      Address,
      DeliveryDestination,
      FileMetadata,
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
    TamSurveysModule,
    DeliverySlotsModule,
    PrinterProfileModule,
    ProductsModule,
  ],
  providers: [OrdersService, OrdersGateway],
  controllers: [OrdersController, ExternalDeliveriesController],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
