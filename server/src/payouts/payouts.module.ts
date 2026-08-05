import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payout } from './entities/payout.entity';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { PaymentsModule } from '../payments/payments.module';
import { AuditModule } from '../audit/audit.module';
import { Order } from '../orders/entities/order.entity';
import { SupplierAssignment } from '../matching/entities/supplier-assignment.entity';
import { GeoZonesModule } from '../geo-zones/geo-zones.module';

/**
 * Supplier payout list + approval + issue-window holds (Phase 8–9).
 * COD recon gate: PaymentsService.assertCodReconciledBeforePayout.
 * Hold reasons: missing_cod_reconciliation | issue_window | open_issue.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payout, Order, SupplierAssignment]),
    forwardRef(() => PaymentsModule),
    AuditModule,
    GeoZonesModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService, TypeOrmModule],
})
export class PayoutsModule {}
