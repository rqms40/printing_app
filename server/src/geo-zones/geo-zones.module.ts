import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeoZone } from './entities/geo-zone.entity';
import { PlatformCommerceSettings } from './entities/platform-commerce-settings.entity';
import { GeoZonesService } from './geo-zones.service';
import { GeoZonesController } from './geo-zones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GeoZone, PlatformCommerceSettings])],
  controllers: [GeoZonesController],
  providers: [GeoZonesService],
  exports: [GeoZonesService, TypeOrmModule],
})
export class GeoZonesModule {}
