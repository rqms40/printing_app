import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeoPoint,
  RouteLeg,
  RouteMatrix,
  RoutingProvider,
} from './routing-provider';

type Fetch = typeof fetch;

type OsrmRouteResponse = {
  code?: unknown;
  routes?: Array<{
    legs?: Array<{ duration?: unknown; distance?: unknown }>;
    geometry?: { type?: unknown; coordinates?: unknown };
  }>;
  waypoints?: Array<{ location?: unknown }>;
};

function routingUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'routing_unavailable',
    message: 'Road routing is temporarily unavailable',
  });
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function validateMatrix(
  value: unknown,
  size: number,
): Array<Array<number | null>> {
  if (!Array.isArray(value) || value.length !== size) {
    throw routingUnavailable();
  }
  return value.map((row) => {
    if (!Array.isArray(row) || row.length !== size) {
      throw routingUnavailable();
    }
    return row.map((cell) => {
      if (cell === null) return null;
      if (!isFiniteNonNegative(cell)) throw routingUnavailable();
      return cell;
    });
  });
}

export class OsrmRoutingProvider implements RoutingProvider {
  readonly name = 'osrm';
  private readonly baseUrl: string;
  private readonly profile: string;
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly fetchImpl: Fetch = fetch,
  ) {
    this.baseUrl = config
      .get<string>('ROUTING_BASE_URL', 'http://osrm:5000')
      .replace(/\/$/, '');
    this.profile = config.get<string>('ROUTING_PROFILE', 'driving');
    const configuredTimeout = Number(
      config.get<string>('ROUTING_TIMEOUT_MS', '5000'),
    );
    this.timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 5000;
  }

  async getMatrix(points: GeoPoint[]): Promise<RouteMatrix> {
    this.assertPoints(points);
    const payload = await this.request<{
      code?: unknown;
      durations?: unknown;
      distances?: unknown;
    }>(
      `/table/v1/${encodeURIComponent(this.profile)}/${this.coordinates(points)}?annotations=duration%2Cdistance`,
    );
    if (payload.code !== 'Ok') throw routingUnavailable();
    return {
      durationsSeconds: validateMatrix(payload.durations, points.length),
      distancesMeters: validateMatrix(payload.distances, points.length),
    };
  }

  async getRoute(points: GeoPoint[]): Promise<RouteLeg[]> {
    this.assertPoints(points);
    return Promise.all(
      points
        .slice(0, -1)
        .map((point, index) => this.getLeg(point, points[index + 1], index)),
    );
  }

  private async getLeg(
    from: GeoPoint,
    to: GeoPoint,
    index: number,
  ): Promise<RouteLeg> {
    const payload = await this.request<OsrmRouteResponse>(
      `/route/v1/${encodeURIComponent(this.profile)}/${this.coordinates([from, to])}?geometries=geojson&overview=full&steps=false`,
    );
    const route = payload.routes?.[0];
    if (
      payload.code !== 'Ok' ||
      !route ||
      !Array.isArray(route.legs) ||
      route.legs.length !== 1 ||
      route.geometry?.type !== 'LineString' ||
      !Array.isArray(route.geometry.coordinates) ||
      route.geometry.coordinates.length < 2
    ) {
      throw routingUnavailable();
    }
    const coordinates = route.geometry.coordinates.map((coordinate) => {
      if (
        !Array.isArray(coordinate) ||
        coordinate.length < 2 ||
        typeof coordinate[0] !== 'number' ||
        typeof coordinate[1] !== 'number' ||
        !Number.isFinite(coordinate[0]) ||
        !Number.isFinite(coordinate[1]) ||
        coordinate[0] < -180 ||
        coordinate[0] > 180 ||
        coordinate[1] < -90 ||
        coordinate[1] > 90
      ) {
        throw routingUnavailable();
      }
      return [coordinate[0], coordinate[1]];
    });
    const [leg] = route.legs;
    if (
      !isFiniteNonNegative(leg.duration) ||
      !isFiniteNonNegative(leg.distance)
    ) {
      throw routingUnavailable();
    }
    return {
      fromIndex: index,
      toIndex: index + 1,
      durationSeconds: leg.duration,
      distanceMeters: leg.distance,
      geometry: { type: 'LineString', coordinates },
    };
  }

  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw routingUnavailable();
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw routingUnavailable();
    } finally {
      clearTimeout(timeout);
    }
  }

  private coordinates(points: GeoPoint[]): string {
    return points
      .map((point) => `${point.longitude},${point.latitude}`)
      .join(';');
  }

  private assertPoints(points: GeoPoint[]): void {
    if (
      points.length < 2 ||
      points.some(
        (point) =>
          !Number.isFinite(point.latitude) ||
          !Number.isFinite(point.longitude) ||
          point.latitude < -90 ||
          point.latitude > 90 ||
          point.longitude < -180 ||
          point.longitude > 180,
      )
    ) {
      throw routingUnavailable();
    }
  }
}
