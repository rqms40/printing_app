import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { DeliverySlotBooking } from './entities/delivery-slot-booking.entity';
import { DeliverySettings } from './entities/delivery-settings.entity';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySettingsService } from './delivery-settings.service';
import { GeoRadiusService } from './geo-radius.service';
import { DeliverySlotsController } from './delivery-slots.controller';
import { DeliverySlotsGateway } from './delivery-slots.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliverySlotTemplate,
      DeliverySlotBooking,
      DeliverySettings,
    ]),
    JwtModule.register({}),
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
