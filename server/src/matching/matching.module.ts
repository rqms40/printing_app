import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplierAssignment } from './entities/supplier-assignment.entity';

/**
 * Matching / supplier assignment scaffold (Task 1.3).
 * Ranking + accept SLA logic lands in Phase 4+.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SupplierAssignment])],
  exports: [TypeOrmModule],
})
export class MatchingModule {}
