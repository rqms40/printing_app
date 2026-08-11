import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierAssignment } from './entities/supplier-assignment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { SupplierCapability } from '../suppliers/entities/supplier-capability.entity';
import { SupplierVerification } from '../suppliers/entities/supplier-verification.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MatchingService } from './matching.service';
import { MatchingController } from './matching.controller';
import { MatchingExpiryScheduler } from './matching-expiry.scheduler';

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
      SupplierCapability,
      SupplierVerification,
      ProductCategory,
    ]),
    AuditModule,
    NotificationsModule,
  ],
  controllers: [MatchingController],
  providers: [MatchingService, MatchingExpiryScheduler],
  exports: [MatchingService, TypeOrmModule],
})
export class MatchingModule {}
