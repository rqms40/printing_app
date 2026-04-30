import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetaModeSettings } from './entities/beta-mode-settings.entity';
import { User } from '../users/entities/user.entity';
import { BetaModeService } from './beta-mode.service';
import { BetaModeController } from './beta-mode.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BetaModeSettings, User])],
  providers: [BetaModeService],
  controllers: [BetaModeController],
  exports: [BetaModeService],
})
export class BetaModeModule {}
