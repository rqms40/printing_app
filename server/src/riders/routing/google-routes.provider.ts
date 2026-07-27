import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GeoPoint,
  RouteLeg,
  RouteMatrix,
  RoutingProvider,
} from './routing-provider';
import { decodeEncodedPolyline } from './polyline';

type Fetch = typeof fetch;

type LatLngLiteral = { latitude: number; longitude: number };

type RouteMatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  status?: { code?: number | string; message?: string };
  condition?: string;
  distanceMeters?: number;
  duration?: string;
};

type ComputeRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    polyline?: { encodedPolyline?: string };
    legs?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
    }>;
  }>;
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

/** Parse Google duration strings like "123s" or "1.5s" into whole seconds. */
export function parseGoogleDurationSeconds(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.round(value);
  }
  if (typeof value !== 'string' || !value.endsWith('s')) {
    throw routingUnavailable();
  }
  const seconds = Number(value.slice(0, -1));
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw routingUnavailable();
  }
  return Math.round(seconds);
}

function waypoint(point: GeoPoint) {
  return {
    location: {
      latLng: {
        latitude: point.latitude,
        longitude: point.longitude,
      } satisfies LatLngLiteral,
    },
  };
}

/**
 * Google Routes API adapter.
 * Implements the same RoutingProvider contract as OSRM so dispatch-plan.service
 * stays provider-agnostic. Encoded polylines are decoded to GeoJSON LineStrings
 * so mobile/admin contracts do not change.
 */
export class GoogleRoutesRoutingProvider implements RoutingProvider {
  readonly name = 'google_routes';
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly routesUrl =
    'https://routes.googleapis.com/directions/v2:computeRoutes';
  private readonly matrixUrl =
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

  constructor(
    config: ConfigService,
    private readonly fetchImpl: Fetch = fetch,
  ) {
    const apiKey =
      config.get<string>('GOOGLE_MAPS_API')?.trim() ||
      config.get<string>('GOOGLE_MAPS_API_KEY')?.trim() ||
      '';
    if (!apiKey) {
      throw new Error(
        'GOOGLE_MAPS_API is required when ROUTING_PROVIDER=google',
      );
    }
    this.apiKey = apiKey;
    const configuredTimeout = Number(
      config.get<string>('ROUTING_TIMEOUT_MS', '8000'),
    );
    this.timeoutMs =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 8000;
  }

  async getMatrix(points: GeoPoint[]): Promise<RouteMatrix> {
    this.assertPoints(points);
    const n = points.length;
    const body = {
      origins: points.map((point) => ({ waypoint: waypoint(point) })),
      destinations: points.map((point) => ({ waypoint: waypoint(point) })),
      travelMode: 'DRIVE',
    };

    const elements = await this.requestMatrix(body);
    const durationsSeconds: Array<Array<number | null>> = Array.from(
      { length: n },
      () => Array.from({ length: n }, () => null),
    );
    const distancesMeters: Array<Array<number | null>> = Array.from(
      { length: n },
      () => Array.from({ length: n }, () => null),
    );

    for (const element of elements) {
      if (
        typeof element.originIndex !== 'number' ||
        typeof element.destinationIndex !== 'number' ||
        element.originIndex < 0 ||
        element.destinationIndex < 0 ||
        element.originIndex >= n ||
        element.destinationIndex >= n
      ) {
        throw routingUnavailable();
      }
      // Diagonal / same point
      if (element.originIndex === element.destinationIndex) {
        durationsSeconds[element.originIndex][element.destinationIndex] = 0;
        distancesMeters[element.originIndex][element.destinationIndex] = 0;
        continue;
      }
      if (element.condition && element.condition !== 'ROUTE_EXISTS') {
        // Leave null — dispatch solver rejects incomplete matrices
        continue;
      }
      if (element.status && element.status.code && element.status.code !== 0) {
        continue;
      }
      if (
        !isFiniteNonNegative(element.distanceMeters) ||
        element.duration === undefined
      ) {
        continue;
      }
      try {
        durationsSeconds[element.originIndex][element.destinationIndex] =
          parseGoogleDurationSeconds(element.duration);
        distancesMeters[element.originIndex][element.destinationIndex] =
          element.distanceMeters;
      } catch {
        // leave null
      }
    }

    // Self-distance always 0 even if Google omits diagonal elements
    for (let i = 0; i < n; i += 1) {
      durationsSeconds[i][i] = 0;
      distancesMeters[i][i] = 0;
    }

    return { durationsSeconds, distancesMeters };
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
    const body = {
      origin: waypoint(from),
      destination: waypoint(to),
      travelMode: 'DRIVE',
      polylineQuality: 'HIGH_QUALITY',
      polylineEncoding: 'ENCODED_POLYLINE',
    };

    const payload = await this.requestJson<ComputeRoutesResponse>(
      this.routesUrl,
      body,
      'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.duration,routes.legs.distanceMeters,routes.legs.polyline.encodedPolyline',
    );

    const route = payload.routes?.[0];
    if (!route) throw routingUnavailable();

    // Prefer leg-level polyline when present; fall back to full route polyline.
    const leg = route.legs?.[0];
    const encoded =
      leg?.polyline?.encodedPolyline || route.polyline?.encodedPolyline;
    if (!encoded) throw routingUnavailable();

    let coordinates: number[][];
    try {
      coordinates = decodeEncodedPolyline(encoded);
    } catch {
      throw routingUnavailable();
    }

    const durationSeconds = parseGoogleDurationSeconds(
      leg?.duration ?? route.duration,
    );
    const distanceMeters = leg?.distanceMeters ?? route.distanceMeters;
    if (!isFiniteNonNegative(distanceMeters)) throw routingUnavailable();

    return {
      fromIndex: index,
      toIndex: index + 1,
      durationSeconds,
      distanceMeters,
      geometry: { type: 'LineString', coordinates },
    };
  }

  private async requestMatrix(
    body: unknown,
  ): Promise<RouteMatrixElement[]> {
    const text = await this.requestText(
      this.matrixUrl,
      body,
      'originIndex,destinationIndex,duration,distanceMeters,status,condition',
    );
    return this.parseMatrixElements(text);
  }

  private parseMatrixElements(text: string): RouteMatrixElement[] {
    const trimmed = text.trim();
    if (!trimmed) throw routingUnavailable();

    // Standard JSON array response
    if (trimmed.startsWith('[')) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        throw routingUnavailable();
      }
      if (!Array.isArray(parsed)) throw routingUnavailable();
      return parsed as RouteMatrixElement[];
    }

    // NDJSON / streaming object-per-line (and concatenated JSON objects)
    const elements: RouteMatrixElement[] = [];
    // Split on newlines first; also handle concatenated `}{` by inserting separators
    const normalized = trimmed.replace(/}\s*{/g, '}\n{');
    for (const line of normalized.split('\n')) {
      const row = line.trim();
      if (!row) continue;
      try {
        elements.push(JSON.parse(row) as RouteMatrixElement);
      } catch {
        throw routingUnavailable();
      }
    }
    if (elements.length === 0) throw routingUnavailable();
    return elements;
  }

  private async requestJson<T>(
    url: string,
    body: unknown,
    fieldMask: string,
  ): Promise<T> {
    const text = await this.requestText(url, body, fieldMask);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw routingUnavailable();
    }
  }

  private async requestText(
    url: string,
    body: unknown,
    fieldMask: string,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-Goog-Api-Key': this.apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw routingUnavailable();
      return await response.text();
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw routingUnavailable();
    } finally {
      clearTimeout(timeout);
    }
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
