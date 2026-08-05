import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { DeliverySlotBooking } from './entities/delivery-slot-booking.entity';
import { DeliverySettings } from './entities/delivery-settings.entity';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySettingsService } from './delivery-settings.service';
import { GeoRadiusService } from './geo-radius.service';
import { DeliverySlotsController } from './delivery-slots.controller';
import { DeliverySlotsGateway } from './delivery-slots.gateway';
import { UsersModule } from '../users/users.module';
import { RealtimeSessionsModule } from '../common/realtime/realtime-sessions.module';
import { GeoZonesModule } from '../geo-zones/geo-zones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliverySlotTemplate,
      DeliverySlotBooking,
      DeliverySettings,
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '7d') },
      }),
    }),
    UsersModule,
    RealtimeSessionsModule,
    forwardRef(() => GeoZonesModule),
  ],
  controllers: [DeliverySlotsController],
  providers: [
    DeliverySlotsService,
    DeliverySettingsService,
    GeoRadiusService,
    DeliverySlotsGateway,
  ],
  exports: [
    DeliverySlotsService,
    DeliverySettingsService,
    DeliverySlotsGateway,
    TypeOrmModule,
  ],
})
export class DeliverySlotsModule {}
