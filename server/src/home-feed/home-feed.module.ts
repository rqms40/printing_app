import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TamSurveysModule } from '../tam-surveys/tam-surveys.module';
import { HomeFeedPromoCard } from './entities/home-feed-promo-card.entity';
import { HomeFeedSettings } from './entities/home-feed-settings.entity';
import { HomeFeedController } from './home-feed.controller';
import { HomeFeedGateway } from './home-feed.gateway';
import { HomeFeedService } from './home-feed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HomeFeedSettings, HomeFeedPromoCard]),
    TamSurveysModule,
  ],
  controllers: [HomeFeedController],
  providers: [HomeFeedService, HomeFeedGateway],
  exports: [HomeFeedService, HomeFeedGateway],
})
export class HomeFeedModule {}
