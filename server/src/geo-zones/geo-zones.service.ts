import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoZone } from './entities/geo-zone.entity';
import { PlatformCommerceSettings } from './entities/platform-commerce-settings.entity';
import {
  CreateGeoZoneDto,
  UpdateCommerceSettingsDto,
  UpdateGeoZoneDto,
} from './dto/geo-zone.dto';
import { pointInPolygon } from './point-in-polygon';

export type ZoneMatchResult = {
  inside: boolean;
  zone: GeoZone | null;
  deliveryFeeMinor: string;
};

@Injectable()
export class GeoZonesService {
  constructor(
    @InjectRepository(GeoZone)
    private readonly zoneRepo: Repository<GeoZone>,
    @InjectRepository(PlatformCommerceSettings)
    private readonly commerceRepo: Repository<PlatformCommerceSettings>,
  ) {}

  async listZones(): Promise<GeoZone[]> {
    return this.zoneRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async listActiveZones(): Promise<GeoZone[]> {
    return this.zoneRepo.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async findById(id: number): Promise<GeoZone> {
    const zone = await this.zoneRepo.findOne({ where: { id } });
    if (!zone) throw new NotFoundException(`Geo zone ${id} not found`);
    return zone;
  }

  async createZone(dto: CreateGeoZoneDto): Promise<GeoZone> {
    this.assertPolygon(dto.polygon);
    const row = this.zoneRepo.create({
      name: dto.name,
      code: dto.code,
      polygon: dto.polygon,
      baseDeliveryFeeMinor: String(dto.baseDeliveryFeeMinor ?? 2500),
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.zoneRepo.save(row);
  }

  async updateZone(id: number, dto: UpdateGeoZoneDto): Promise<GeoZone> {
    const zone = await this.findById(id);
    if (dto.polygon) this.assertPolygon(dto.polygon);
    if (dto.name !== undefined) zone.name = dto.name;
    if (dto.code !== undefined) zone.code = dto.code;
    if (dto.polygon !== undefined) zone.polygon = dto.polygon;
    if (dto.baseDeliveryFeeMinor !== undefined) {
      zone.baseDeliveryFeeMinor = String(dto.baseDeliveryFeeMinor);
    }
    if (dto.isActive !== undefined) zone.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) zone.sortOrder = dto.sortOrder;
    return this.zoneRepo.save(zone);
  }

  async getCommerceSettings(): Promise<PlatformCommerceSettings> {
    const existing = await this.commerceRepo.findOne({ where: { id: 1 } });
    if (existing) return existing;
    return this.commerceRepo.save(
      this.commerceRepo.create({
        id: 1,
        defaultCommissionBps: 1500,
        defaultDeliveryFeeMinor: '2500',
        rejectOutsideZones: true,
      }),
    );
  }

  async updateCommerceSettings(
    dto: UpdateCommerceSettingsDto,
  ): Promise<PlatformCommerceSettings> {
    const settings = await this.getCommerceSettings();
    if (dto.defaultCommissionBps !== undefined) {
      settings.defaultCommissionBps = dto.defaultCommissionBps;
    }
    if (dto.defaultDeliveryFeeMinor !== undefined) {
      settings.defaultDeliveryFeeMinor = String(dto.defaultDeliveryFeeMinor);
    }
    if (dto.rejectOutsideZones !== undefined) {
      settings.rejectOutsideZones = dto.rejectOutsideZones;
    }
    return this.commerceRepo.save(settings);
  }

  /**
   * Match lat/lng against active zones. First matching zone wins (by sort_order).
   * When no active zones exist, returns inside=null semantics via `zone: null`
   * and commerce default fee — caller falls back to radius settings.
   */
  async matchPoint(
    lat: number | null,
    lng: number | null,
  ): Promise<ZoneMatchResult> {
    const commerce = await this.getCommerceSettings();
    if (lat == null || lng == null) {
      return {
        inside: false,
        zone: null,
        deliveryFeeMinor: commerce.defaultDeliveryFeeMinor,
      };
    }

    const zones = await this.listActiveZones();
    if (zones.length === 0) {
      return {
        inside: false,
        zone: null,
        deliveryFeeMinor: commerce.defaultDeliveryFeeMinor,
      };
    }

    for (const zone of zones) {
      if (pointInPolygon(lat, lng, zone.polygon)) {
        return {
          inside: true,
          zone,
          deliveryFeeMinor: zone.baseDeliveryFeeMinor,
        };
      }
    }

    return {
      inside: false,
      zone: null,
      deliveryFeeMinor: commerce.defaultDeliveryFeeMinor,
    };
  }

  /** True when active zones exist and the point is inside at least one. */
  async isInsideAnyZone(
    lat: number | null,
    lng: number | null,
  ): Promise<boolean> {
    const zones = await this.listActiveZones();
    if (zones.length === 0) return false;
    if (lat == null || lng == null) return false;
    return zones.some((z) => pointInPolygon(lat, lng, z.polygon));
  }

  async hasActiveZones(): Promise<boolean> {
    const count = await this.zoneRepo.count({ where: { isActive: true } });
    return count > 0;
  }

  /** Commission minor from gross minor using platform default bps. */
  async computeCommissionMinor(grossMinor: string | number): Promise<string> {
    const settings = await this.getCommerceSettings();
    const gross = Number(grossMinor);
    if (!Number.isFinite(gross) || gross < 0) {
      throw new BadRequestException('Invalid gross amount for commission');
    }
    const commission = Math.round(
      (gross * settings.defaultCommissionBps) / 10_000,
    );
    return String(commission);
  }

  private assertPolygon(polygon: {
    type?: string;
    coordinates?: number[][][];
  }): void {
    if (
      polygon?.type !== 'Polygon' ||
      !Array.isArray(polygon.coordinates) ||
      !Array.isArray(polygon.coordinates[0]) ||
      polygon.coordinates[0].length < 4
    ) {
      throw new BadRequestException(
        'polygon must be a GeoJSON Polygon with a closed ring of ≥4 positions',
      );
    }
  }
}
