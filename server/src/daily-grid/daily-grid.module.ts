import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyGridCard } from './entities/daily-grid-card.entity';
import { DailyGridService } from './daily-grid.service';
import { DailyGridController } from './daily-grid.controller';
import { DailyGridGateway } from './daily-grid.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([DailyGridCard])],
  controllers: [DailyGridController],
  providers: [DailyGridService, DailyGridGateway],
  exports: [DailyGridGateway],
})
export class DailyGridModule {}
