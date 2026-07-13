export type GeoPoint = { latitude: number; longitude: number };

export type RouteMatrix = {
  durationsSeconds: Array<Array<number | null>>;
  distancesMeters: Array<Array<number | null>>;
};

export type LineStringGeometry = {
  type: 'LineString';
  coordinates: number[][];
};

export type RouteLeg = {
  fromIndex: number;
  toIndex: number;
  durationSeconds: number;
  distanceMeters: number;
  geometry: LineStringGeometry;
};

export interface RoutingProvider {
  readonly name: string;
  getMatrix(points: GeoPoint[]): Promise<RouteMatrix>;
  getRoute(points: GeoPoint[]): Promise<RouteLeg[]>;
}

export const ROUTING_PROVIDER = Symbol('ROUTING_PROVIDER');
