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
import { SuppliersModule } from '../suppliers/suppliers.module';
import { FilesModule } from '../files/files.module';
import { FileMetadata } from '../files/entities/file-metadata.entity';

/**
 * Supplier payout list + approval + issue-window holds (Phase 8–9).
 * COD recon gate: PaymentsService.assertCodReconciledBeforePayout.
 * Hold reasons: missing_cod_reconciliation | issue_window | open_issue.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payout, Order, SupplierAssignment, FileMetadata]),
    forwardRef(() => PaymentsModule),
    AuditModule,
    GeoZonesModule,
    SuppliersModule,
    FilesModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService, TypeOrmModule],
})
export class PayoutsModule {}
