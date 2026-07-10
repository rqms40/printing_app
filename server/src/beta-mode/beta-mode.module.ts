import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BetaModeSettings } from './entities/beta-mode-settings.entity';
import { User } from '../users/entities/user.entity';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { BetaModeService } from './beta-mode.service';
import { BetaModeController } from './beta-mode.controller';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([BetaModeSettings, User, FileMetadata]),
    CreditsModule,
  ],
  providers: [BetaModeService],
  controllers: [BetaModeController],
  exports: [BetaModeService],
})
export class BetaModeModule {}
