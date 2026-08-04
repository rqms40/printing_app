import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Issue } from './entities/issue.entity';

/**
 * Issues / claims scaffold (Task 1.3).
 * 24h window + payout freeze logic lands in Phase 9.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Issue])],
  exports: [TypeOrmModule],
})
export class IssuesModule {}
