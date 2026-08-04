import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QualityReview } from './entities/quality-review.entity';

/**
 * Quality / Ops QA scaffold (Task 1.3).
 * Business logic lands in later QA/matching phases.
 */
@Module({
  imports: [TypeOrmModule.forFeature([QualityReview])],
  exports: [TypeOrmModule],
})
export class QualityModule {}
