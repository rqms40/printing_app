import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payout } from './entities/payout.entity';

/**
 * Payouts / finance scaffold (Task 1.3).
 * Hold/release settlement logic lands in later finance phases.
 *
 * COD recon hook (Task 3.2): when order payment method is COD, supplier
 * payout must stay held until cash is reconciled. Call
 * `PaymentsService.applyCodPayoutHold(orderId)` on payout create / collect,
 * and `PaymentsService.assertCodReconciledBeforePayout(orderId)` before
 * release. Hold reason constant: `missing_cod_reconciliation`
 * (`COD_PAYOUT_HOLD_REASON` in payments/cod-eligibility.ts).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Payout])],
  exports: [TypeOrmModule],
})
export class PayoutsModule {}
