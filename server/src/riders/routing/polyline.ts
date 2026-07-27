/**
 * Decode a Google Encoded Polyline into GeoJSON-order coordinates [lng, lat].
 * Spec: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodeEncodedPolyline(encoded: string): number[][] {
  if (typeof encoded !== 'string' || encoded.length === 0) {
    throw new Error('empty polyline');
  }

  const coordinates: number[][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) throw new Error('truncated polyline');
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;

    result = 0;
    shift = 0;
    do {
      if (index >= encoded.length) throw new Error('truncated polyline');
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;

    const latitude = lat / 1e5;
    const longitude = lng / 1e5;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new Error('invalid polyline coordinate');
    }
    coordinates.push([longitude, latitude]);
  }

  if (coordinates.length < 2) {
    throw new Error('polyline must contain at least 2 points');
  }

  return coordinates;
}
