export type GeocodeHit = {
  latitude: number;
  longitude: number;
  displayName: string;
};

export type NominatimFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

const MIN_SUGGEST_LENGTH = 3;
const PHOTON_URL = 'https://photon.komoot.io/api/';
const DAVAO_BIAS = { lat: '7.0731', lon: '125.6128' };

function validPoint(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

export function normalizeShopQuery(raw: string): string | null {
  const query = raw.trim().replace(/\s+/g, ' ');
  if (query.length < MIN_SUGGEST_LENGTH) return null;
  if (/davao|philippines|\bph\b/i.test(query)) return query;
  return `${query}, Davao City, Philippines`;
}

function photonLabel(properties: Record<string, unknown>, fallback: string): string {
  const parts = [
    properties.housenumber,
    properties.street,
    properties.name,
    properties.district,
    properties.city,
    properties.county,
    properties.state,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part, index, all) => part.length > 0 && all.indexOf(part) === index);
  return parts.length > 0 ? parts.join(', ') : fallback;
}

export async function searchShopAddresses(
  raw: string,
  limit = 6,
  fetchImpl: NominatimFetch = fetch,
): Promise<GeocodeHit[]> {
  const query = raw.trim().replace(/\s+/g, ' ');
  if (query.length < MIN_SUGGEST_LENGTH) return [];

  const url = new URL(PHOTON_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(Math.min(8, Math.max(1, limit))));
  url.searchParams.set('lat', DAVAO_BIAS.lat);
  url.searchParams.set('lon', DAVAO_BIAS.lon);
  url.searchParams.set('lang', 'en');

  const response = await fetchImpl(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'GRIDGO-printing-app/1.0',
    },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) return [];

  const body = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: unknown };
      properties?: Record<string, unknown>;
    }>;
  };
  const hits: GeocodeHit[] = [];
  const seen = new Set<string>();
  for (const feature of body.features ?? []) {
    const coords = feature.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const longitude = Number(coords[0]);
    const latitude = Number(coords[1]);
    if (!validPoint(latitude, longitude)) continue;
    const country = String(
      feature.properties?.countrycode ?? feature.properties?.country ?? '',
    ).toUpperCase();
    if (country && country !== 'PH' && country !== 'PHILIPPINES') continue;
    const displayName = photonLabel(feature.properties ?? {}, query);
    const key = `${displayName}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ latitude, longitude, displayName });
  }
  return hits;
}

export async function geocodeAddress(
  raw: string,
  fetchImpl: NominatimFetch = fetch,
): Promise<GeocodeHit | null> {
  const hits = await searchShopAddresses(raw, 1, fetchImpl);
  return hits[0] ?? null;
}
