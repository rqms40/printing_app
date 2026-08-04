import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditEvent } from './entities/audit-event.entity';

/**
 * Audit event scaffold (Task 1.3).
 * Append-only writers hook from orders/quality/matching/payments later.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent])],
  exports: [TypeOrmModule],
})
export class AuditModule {}
