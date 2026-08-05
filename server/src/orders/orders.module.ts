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
import { PaymentTimeoutScheduler } from './payment-timeout.scheduler';
import { UsersModule } from '../users/users.module';
import { CreditsModule } from '../credits/credits.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { FilesModule } from '../files/files.module';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { DeliveryAssignment } from '../riders/entities/delivery-assignment.entity';
import { Address } from '../addresses/entities/address.entity';
import { DeliverySlotsModule } from '../delivery-slots/delivery-slots.module';
import { PrinterProfileModule } from '../printer-profile/printer-profile.module';
import { TamSurveysModule } from '../tam-surveys/tam-surveys.module';
import { ProductsModule } from '../products/products.module';
import { DispatchPlan } from '../riders/entities/dispatch-plan.entity';
import { RealtimeSessionsModule } from '../common/realtime/realtime-sessions.module';
import { AuditModule } from '../audit/audit.module';
import { PaymentsModule } from '../payments/payments.module';
import { QualityModule } from '../quality/quality.module';
import { GeoZonesModule } from '../geo-zones/geo-zones.module';
import { PayoutsModule } from '../payouts/payouts.module';

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
      DispatchPlan,
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
    RealtimeSessionsModule,
    AuditModule,
    PaymentsModule,
    QualityModule,
    GeoZonesModule,
    PayoutsModule,
  ],
  providers: [OrdersService, OrdersGateway, PaymentTimeoutScheduler],
  controllers: [OrdersController, ExternalDeliveriesController],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}
