import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Notification } from './entities/notification.entity';
import { MarketingNotification } from './entities/marketing-notification.entity';
import { NotificationsService } from './notifications.service';
import { MarketingSchedulerService } from './marketing-scheduler.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, MarketingNotification]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '7d') },
      }),
    }),
    forwardRef(() => UsersModule),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    MarketingSchedulerService,
    NotificationsGateway,
  ],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
