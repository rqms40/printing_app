import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Issue } from './entities/issue.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { AuditModule } from '../audit/audit.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { IssueWindowScheduler } from './issue-window.scheduler';

/**
 * Material claims + 24h issue window (Phase 9.2).
 * Timely issue freezes payout; resolve paths audit status changes.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Issue, Order, OrderStatusHistory]),
    AuditModule,
    forwardRef(() => PayoutsModule),
  ],
  controllers: [IssuesController],
  providers: [IssuesService, IssueWindowScheduler],
  exports: [IssuesService, TypeOrmModule],
})
export class IssuesModule {}
