import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityReview } from './entities/quality-review.entity';
import { PickupQaSubmission } from './entities/pickup-qa-submission.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { User } from '../users/entities/user.entity';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { QualityService } from './quality.service';
import { QualityController } from './quality.controller';

/**
 * Ops Quality / QA gate (Task 4.1) + Pickup QA submissions (supplier/rider).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      QualityReview,
      PickupQaSubmission,
      Order,
      OrderStatusHistory,
      User,
    ]),
    AuditModule,
    FilesModule,
  ],
  controllers: [QualityController],
  providers: [QualityService],
  exports: [QualityService, TypeOrmModule],
})
export class QualityModule {}
