import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyGridCard } from './entities/daily-grid-card.entity';
import { DailyGridService } from './daily-grid.service';
import { DailyGridController } from './daily-grid.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DailyGridCard])],
  controllers: [DailyGridController],
  providers: [DailyGridService],
})
export class DailyGridModule {}
