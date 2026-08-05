/**
 * Ray-casting point-in-polygon.
 * @param lat latitude
 * @param lng longitude
 * @param ring closed ring of [lng, lat] pairs
 */
export function pointInRing(
  lat: number,
  lng: number,
  ring: number[][],
): boolean {
  if (!ring || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True if (lat,lng) is inside any ring of a GeoJSON Polygon. */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: { type?: string; coordinates?: number[][][] } | null | undefined,
): boolean {
  if (!polygon?.coordinates?.length) return false;
  // First ring is exterior; ignore holes for simplified pilot zones.
  return pointInRing(lat, lng, polygon.coordinates[0]);
}
