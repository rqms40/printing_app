import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payout } from './entities/payout.entity';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { PaymentsModule } from '../payments/payments.module';
import { AuditModule } from '../audit/audit.module';

/**
 * Supplier payout list + approval (Phase 8).
 * COD recon gate: PaymentsService.assertCodReconciledBeforePayout.
 * Hold reason: missing_cod_reconciliation (cod-eligibility.ts).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Payout]),
    forwardRef(() => PaymentsModule),
    AuditModule,
  ],
  controllers: [PayoutsController],
  providers: [PayoutsService],
  exports: [PayoutsService, TypeOrmModule],
})
export class PayoutsModule {}
