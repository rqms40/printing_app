import type {
  GeoPoint,
  RouteLeg,
  RouteMatrix,
  RoutingProvider,
} from '../../src/riders/routing/routing-provider';

function roadCost(from: GeoPoint, to: GeoPoint): number {
  return Math.round(
    Math.abs(to.latitude - from.latitude) * 100_000 +
      Math.abs(to.longitude - from.longitude) * 10_000,
  );
}

export class FakeRoutingProvider implements RoutingProvider {
  readonly name = 'fake-osrm';

  async getMatrix(points: GeoPoint[]): Promise<RouteMatrix> {
    return {
      durationsSeconds: points.map((from) =>
        points.map((to) => roadCost(from, to)),
      ),
      distancesMeters: points.map((from) =>
        points.map((to) => roadCost(from, to) * 5),
      ),
    };
  }

  async getRoute(points: GeoPoint[]): Promise<RouteLeg[]> {
    return points.slice(0, -1).map((from, index) => {
      const to = points[index + 1];
      const durationSeconds = roadCost(from, to);
      return {
        fromIndex: index,
        toIndex: index + 1,
        durationSeconds,
        distanceMeters: durationSeconds * 5,
        geometry: {
          type: 'LineString',
          coordinates: [
            [from.longitude, from.latitude],
            [to.longitude, to.latitude],
          ],
        },
      };
    });
  }
}
