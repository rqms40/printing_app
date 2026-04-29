import { GeoRadiusService } from './geo-radius.service';

describe('GeoRadiusService', () => {
  const svc = new GeoRadiusService();
  const center = { lat: 7.0731, lng: 125.6128 }; // Davao City Hall

  it('returns true for the center point', () => {
    expect(svc.isInsideRadius(center.lat, center.lng, center, 25)).toBe(true);
  });

  it('returns true at exactly the boundary (inclusive)', () => {
    // 1 degree latitude ≈ 111 km; offset by 25/111 deg
    const boundary = { lat: center.lat + 25 / 111, lng: center.lng };
    expect(svc.isInsideRadius(boundary.lat, boundary.lng, center, 25)).toBe(true);
  });

  it('returns false beyond the radius', () => {
    expect(svc.isInsideRadius(8.5, 125.6128, center, 25)).toBe(false);
  });

  it('returns false when target coords are null', () => {
    expect(svc.isInsideRadius(null, null, center, 25)).toBe(false);
  });
});
