import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliverySettings } from './entities/delivery-settings.entity';
import { GeoRadiusService } from './geo-radius.service';
import { GeoZonesService } from '../geo-zones/geo-zones.service';

@Injectable()
export class DeliverySettingsService {
  constructor(
    @InjectRepository(DeliverySettings)
    private readonly repo: Repository<DeliverySettings>,
    private readonly geo: GeoRadiusService,
    @Optional() private readonly geoZones?: GeoZonesService,
  ) {}

  async getSettings(): Promise<DeliverySettings> {
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (existing) return existing;
    return this.repo.save(
      this.repo.create({
        id: 1,
        serviceCenterLat: 7.0731,
        serviceCenterLng: 125.6128,
        serviceRadiusKm: 25,
        priorityFeeAmount: 50,
        deliveryFeePerKm: 50,
        extraDestinationSurcharge: 30,
        serviceFeePercent: 0,
      }),
    );
  }

  async updateSettings(
    patch: Partial<DeliverySettings>,
  ): Promise<DeliverySettings> {
    const current = await this.getSettings();
    Object.assign(current, patch);
    return this.repo.save(current);
  }

  /**
   * Prefer active geo zones when configured; fall back to radius circle.
   */
  async isInsideServiceArea(
    lat: number | null,
    lng: number | null,
  ): Promise<boolean> {
    if (this.geoZones) {
      try {
        const hasZones = await this.geoZones.hasActiveZones();
        if (hasZones) {
          return this.geoZones.isInsideAnyZone(lat, lng);
        }
      } catch {
        // Zones module unavailable — fall through to radius.
      }
    }
    const s = await this.getSettings();
    return this.geo.isInsideRadius(
      lat,
      lng,
      { lat: Number(s.serviceCenterLat), lng: Number(s.serviceCenterLng) },
      Number(s.serviceRadiusKm),
    );
  }
}
