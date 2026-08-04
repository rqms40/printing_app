import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payout } from './entities/payout.entity';

/**
 * Payouts / finance scaffold (Task 1.3).
 * Hold/release settlement logic lands in later finance phases.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Payout])],
  exports: [TypeOrmModule],
})
export class PayoutsModule {}
