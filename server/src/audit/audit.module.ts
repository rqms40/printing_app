import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './entities/audit-event.entity';
import { AuditService } from './audit.service';

/**
 * Append-only audit events (Task 2.3).
 * Import AuditModule and inject AuditService from orders, quality,
 * matching, payments, payouts, etc.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  providers: [AuditService],
  exports: [AuditService, TypeOrmModule],
})
export class AuditModule {}
