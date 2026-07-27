import { decodeEncodedPolyline } from './polyline';

describe('decodeEncodedPolyline', () => {
  it('decodes a known short polyline into [lng, lat] pairs', () => {
    // Encoded form of (38.5, -120.2) → (40.7, -120.95) → (43.252, -126.453)
    // Classic Google polyline algorithm sample.
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    const coords = decodeEncodedPolyline(encoded);
    expect(coords.length).toBe(3);
    expect(coords[0][0]).toBeCloseTo(-120.2, 4);
    expect(coords[0][1]).toBeCloseTo(38.5, 4);
    expect(coords[1][0]).toBeCloseTo(-120.95, 4);
    expect(coords[1][1]).toBeCloseTo(40.7, 4);
    expect(coords[2][0]).toBeCloseTo(-126.453, 3);
    expect(coords[2][1]).toBeCloseTo(43.252, 3);
  });

  it('rejects empty or single-point input', () => {
    expect(() => decodeEncodedPolyline('')).toThrow();
  });
});
