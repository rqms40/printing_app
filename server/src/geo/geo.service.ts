import {
  Injectable,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type Fetch = typeof fetch;

export type ReverseGeocodeResult = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  placeId?: string;
  components: {
    street?: string;
    barangay?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
};

export type AutocompleteSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
};

export type PlaceDetailsResult = {
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
};

@Injectable()
export class GeoService {
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly storeLat: number;
  private readonly storeLng: number;

  private fetchImpl: Fetch = fetch;

  constructor(private readonly config: ConfigService) {
    this.apiKey =
      config.get<string>('GOOGLE_MAPS_API')?.trim() ||
      config.get<string>('GOOGLE_MAPS_API_KEY')?.trim() ||
      '';
    const timeout = Number(config.get<string>('ROUTING_TIMEOUT_MS', '8000'));
    this.timeoutMs =
      Number.isFinite(timeout) && timeout > 0 ? timeout : 8000;
    this.storeLat = Number(
      config.get<string>('GRIDGO_STORE_LATITUDE', '7.064'),
    );
    this.storeLng = Number(
      config.get<string>('GRIDGO_STORE_LONGITUDE', '125.6079'),
    );
  }

  /** Test-only fetch override (Nest must not DI-inject `fetch`). */
  useFetchImpl(fetchImpl: Fetch): this {
    this.fetchImpl = fetchImpl;
    return this;
  }

  private ensureKey(): void {
    if (!this.apiKey) {
      throw new ServiceUnavailableException({
        code: 'geo_unavailable',
        message: 'Google Maps geocoding is not configured',
      });
    }
  }

  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<ReverseGeocodeResult> {
    this.ensureKey();
    this.assertLatLng(latitude, longitude);

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('language', 'en');
    url.searchParams.set('region', 'ph');

    const payload = await this.getJson<{
      status?: string;
      results?: Array<{
        formatted_address?: string;
        place_id?: string;
        address_components?: Array<{
          long_name?: string;
          short_name?: string;
          types?: string[];
        }>;
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
      error_message?: string;
    }>(url);

    if (payload.status !== 'OK' || !payload.results?.length) {
      if (payload.status === 'ZERO_RESULTS') {
        return {
          formattedAddress: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          latitude,
          longitude,
          components: {},
        };
      }
      throw new ServiceUnavailableException({
        code: 'geo_unavailable',
        message: 'Reverse geocoding is temporarily unavailable',
      });
    }

    const top = payload.results[0];
    return {
      formattedAddress: top.formatted_address ?? '',
      latitude: top.geometry?.location?.lat ?? latitude,
      longitude: top.geometry?.location?.lng ?? longitude,
      placeId: top.place_id,
      components: this.mapComponents(top.address_components ?? []),
    };
  }

  async autocomplete(
    query: string,
    sessionToken?: string,
  ): Promise<AutocompleteSuggestion[]> {
    this.ensureKey();
    const q = query?.trim() ?? '';
    if (q.length < 2) return [];

    const url = new URL(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
    );
    url.searchParams.set('input', q);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('language', 'en');
    url.searchParams.set('components', 'country:ph');
    // Bias toward Davao store
    url.searchParams.set(
      'location',
      `${this.storeLat},${this.storeLng}`,
    );
    url.searchParams.set('radius', '40000');
    if (sessionToken?.trim()) {
      url.searchParams.set('sessiontoken', sessionToken.trim());
    }

    const payload = await this.getJson<{
      status?: string;
      predictions?: Array<{
        place_id?: string;
        description?: string;
        structured_formatting?: {
          main_text?: string;
          secondary_text?: string;
        };
      }>;
    }>(url);

    if (
      payload.status !== 'OK' &&
      payload.status !== 'ZERO_RESULTS'
    ) {
      throw new ServiceUnavailableException({
        code: 'geo_unavailable',
        message: 'Place autocomplete is temporarily unavailable',
      });
    }

    return (payload.predictions ?? [])
      .filter((p) => p.place_id && p.description)
      .map((p) => ({
        placeId: p.place_id as string,
        description: p.description as string,
        mainText:
          p.structured_formatting?.main_text ?? (p.description as string),
        secondaryText: p.structured_formatting?.secondary_text,
      }));
  }

  async placeDetails(
    placeId: string,
    sessionToken?: string,
  ): Promise<PlaceDetailsResult> {
    this.ensureKey();
    if (!placeId?.trim()) {
      throw new BadRequestException('placeId is required');
    }

    const url = new URL(
      'https://maps.googleapis.com/maps/api/place/details/json',
    );
    url.searchParams.set('place_id', placeId.trim());
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('fields', 'place_id,formatted_address,geometry');
    url.searchParams.set('language', 'en');
    if (sessionToken?.trim()) {
      url.searchParams.set('sessiontoken', sessionToken.trim());
    }

    const payload = await this.getJson<{
      status?: string;
      result?: {
        place_id?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      };
    }>(url);

    const result = payload.result;
    const lat = result?.geometry?.location?.lat;
    const lng = result?.geometry?.location?.lng;
    if (
      payload.status !== 'OK' ||
      !result?.place_id ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      throw new ServiceUnavailableException({
        code: 'geo_unavailable',
        message: 'Place details are temporarily unavailable',
      });
    }

    return {
      placeId: result.place_id,
      formattedAddress: result.formatted_address ?? '',
      latitude: lat as number,
      longitude: lng as number,
    };
  }

  private mapComponents(
    components: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>,
  ): ReverseGeocodeResult['components'] {
    const find = (...types: string[]) =>
      components.find((c) => types.some((t) => c.types?.includes(t)))
        ?.long_name;

    const route = find('route');
    const streetNumber = find('street_number');
    const street =
      route && streetNumber
        ? `${streetNumber} ${route}`
        : route ?? streetNumber;

    return {
      street,
      barangay: find('sublocality', 'sublocality_level_1', 'neighborhood'),
      city: find('locality', 'administrative_area_level_2'),
      province: find('administrative_area_level_1'),
      postalCode: find('postal_code'),
      country: find('country'),
    };
  }

  private assertLatLng(latitude: number, longitude: number): void {
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException('Invalid latitude/longitude');
    }
  }

  private async getJson<T>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url.toString(), {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ServiceUnavailableException({
          code: 'geo_unavailable',
          message: 'Google geo request failed',
        });
      }
      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new ServiceUnavailableException({
        code: 'geo_unavailable',
        message: 'Google geo request failed',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
