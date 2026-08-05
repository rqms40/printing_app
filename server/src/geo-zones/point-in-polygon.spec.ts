import { pointInPolygon, pointInRing } from './point-in-polygon';

/** Simplified Davao City core box from seed. */
const DAVAO_RING: number[][] = [
  [125.45, 7.0],
  [125.75, 7.0],
  [125.75, 7.2],
  [125.45, 7.2],
  [125.45, 7.0],
];

describe('pointInPolygon', () => {
  it('accepts points inside the ring', () => {
    expect(pointInRing(7.07, 125.61, DAVAO_RING)).toBe(true);
    expect(
      pointInPolygon(7.07, 125.61, {
        type: 'Polygon',
        coordinates: [DAVAO_RING],
      }),
    ).toBe(true);
  });

  it('rejects points outside the ring', () => {
    expect(pointInRing(14.6, 121.0, DAVAO_RING)).toBe(false);
    expect(
      pointInPolygon(8.5, 125.6, {
        type: 'Polygon',
        coordinates: [DAVAO_RING],
      }),
    ).toBe(false);
  });

  it('handles empty / invalid polygons', () => {
    expect(pointInPolygon(7, 125, null)).toBe(false);
    expect(pointInPolygon(7, 125, { type: 'Polygon', coordinates: [] })).toBe(
      false,
    );
    expect(pointInRing(7, 125, [])).toBe(false);
  });
});
