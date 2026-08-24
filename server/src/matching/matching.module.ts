import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierAssignment } from './entities/supplier-assignment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { SupplierCatalogOffering } from '../suppliers/entities/supplier-catalog-offering.entity';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { MatchingPreviewController } from './matching-preview.controller';
import { MatchingExpiryScheduler } from './matching-expiry.scheduler';
import { Address } from '../addresses/entities/address.entity';
import { UsersModule } from '../users/users.module';
import { DeliverySlotsModule } from '../delivery-slots/delivery-slots.module';
import { ConfigService } from '@nestjs/config';
import { ROUTING_PROVIDER } from '../riders/routing/routing-provider';
import { OsrmRoutingProvider } from '../riders/routing/osrm-routing.provider';

/**
 * Supplier matching / assignment (Task 4.2).
 * Ranks verified suppliers, creates SupplierAssignment with accept SLA,
 * and expires unconfirmed assignments back to approved_for_matching.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      SupplierAssignment,
      Order,
      OrderStatusHistory,
      SupplierProfile,
      SupplierCatalogOffering,
      Address,
    ]),
    AuditModule,
    NotificationsModule,
    UsersModule,
    DeliverySlotsModule,
  ],
  controllers: [MatchingController, MatchingPreviewController],
  providers: [
    MatchingService,
    MatchingExpiryScheduler,
    {
      provide: ROUTING_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new OsrmRoutingProvider(config),
    },
  ],
  exports: [MatchingService, TypeOrmModule],
})
export class MatchingModule {}
