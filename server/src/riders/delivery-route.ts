import { DeliveryAssignment } from './entities/delivery-assignment.entity';

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export const SHOP_LOCATION: GeoPoint = {
  latitude: 7.064,
  longitude: 125.6079,
};

export function toGeoPoint(
  latitude: number | string | null | undefined,
  longitude: number | string | null | undefined,
): GeoPoint | null {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { latitude: lat, longitude: lng };
}

function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function orderDeliveryAssignmentsByRoute(
  assignments: DeliveryAssignment[],
  startPoint: GeoPoint = SHOP_LOCATION,
): DeliveryAssignment[] {
  const stableAssignments = [...assignments].sort((a, b) => a.id - b.id);
  const routeable = stableAssignments
    .map((assignment, index) => ({
      assignment,
      index,
      point: toGeoPoint(
        assignment.order?.destination?.latitude,
        assignment.order?.destination?.longitude,
      ),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        assignment: DeliveryAssignment;
        index: number;
        point: GeoPoint;
      } => candidate.point !== null,
    );
  const missingCoordinates = stableAssignments.filter(
    (assignment) =>
      !toGeoPoint(
        assignment.order?.destination?.latitude,
        assignment.order?.destination?.longitude,
      ),
  );

  const ordered: DeliveryAssignment[] = [];
  let currentPoint = startPoint;
  const remaining = [...routeable];

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const distance = distanceKm(currentPoint, remaining[index].point);
      if (
        distance < nearestDistance ||
        (distance === nearestDistance &&
          remaining[index].index < remaining[nearestIndex].index)
      ) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    }
    const [nearest] = remaining.splice(nearestIndex, 1);
    ordered.push(nearest.assignment);
    currentPoint = nearest.point;
  }

  return [...ordered, ...missingCoordinates];
}
