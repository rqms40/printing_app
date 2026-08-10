import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityReview } from './entities/quality-review.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { AuditModule } from '../audit/audit.module';
import { FilesModule } from '../files/files.module';
import { QualityService } from './quality.service';
import { QualityController } from './quality.controller';

/**
 * Ops Quality / QA gate (Task 4.1).
 * Mandatory artwork review before matching; ops_admin / super_admin only.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([QualityReview, Order, OrderStatusHistory]),
    AuditModule,
    FilesModule,
  ],
  controllers: [QualityController],
  providers: [QualityService],
  exports: [QualityService, TypeOrmModule],
})
export class QualityModule {}
