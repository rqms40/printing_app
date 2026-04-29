import { Injectable } from '@nestjs/common';

@Injectable()
export class GeoRadiusService {
  isInsideRadius(
    lat: number | null,
    lng: number | null,
    center: { lat: number; lng: number },
    radiusKm: number,
  ): boolean {
    if (lat == null || lng == null) return false;
    const R = 6371; // km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat - center.lat);
    const dLng = toRad(lng - center.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(center.lat)) *
        Math.cos(toRad(lat)) *
        Math.sin(dLng / 2) ** 2;
    const distance = 2 * R * Math.asin(Math.sqrt(a));
    return distance <= radiusKm;
  }
}
