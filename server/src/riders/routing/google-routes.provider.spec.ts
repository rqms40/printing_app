import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleRoutesRoutingProvider,
  parseGoogleDurationSeconds,
} from './google-routes.provider';

describe('GoogleRoutesRoutingProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  function provider(env: Record<string, string> = {}) {
    return new GoogleRoutesRoutingProvider(
      new ConfigService({
        GOOGLE_MAPS_API: 'test-key',
        ROUTING_TIMEOUT_MS: '250',
        ...env,
      }),
      fetchMock,
    );
  }

  it('fails fast when GOOGLE_MAPS_API is missing', () => {
    expect(
      () =>
        new GoogleRoutesRoutingProvider(
          new ConfigService({}),
          fetchMock,
        ),
    ).toThrow(/GOOGLE_MAPS_API/);
  });

  it('accepts GOOGLE_MAPS_API_KEY alias', () => {
    expect(
      () =>
        new GoogleRoutesRoutingProvider(
          new ConfigService({ GOOGLE_MAPS_API_KEY: 'alias-key' }),
          fetchMock,
        ),
    ).not.toThrow();
  });

  it('builds a duration/distance matrix from computeRouteMatrix elements', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify([
          {
            originIndex: 0,
            destinationIndex: 0,
            duration: '0s',
            distanceMeters: 0,
            condition: 'ROUTE_EXISTS',
          },
          {
            originIndex: 0,
            destinationIndex: 1,
            duration: '20s',
            distanceMeters: 110,
            condition: 'ROUTE_EXISTS',
          },
          {
            originIndex: 1,
            destinationIndex: 0,
            duration: '22s',
            distanceMeters: 115,
            condition: 'ROUTE_EXISTS',
          },
          {
            originIndex: 1,
            destinationIndex: 1,
            duration: '0s',
            distanceMeters: 0,
            condition: 'ROUTE_EXISTS',
          },
        ]),
    });

    await expect(
      provider().getMatrix([
        { latitude: 7.064, longitude: 125.6079 },
        { latitude: 7.0641, longitude: 125.6079 },
      ]),
    ).resolves.toEqual({
      durationsSeconds: [
        [0, 20],
        [22, 0],
      ],
      distancesMeters: [
        [0, 110],
        [115, 0],
      ],
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix',
    );
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(init.headers['X-Goog-FieldMask']).toContain('duration');
    const body = JSON.parse(init.body as string);
    expect(body.travelMode).toBe('DRIVE');
    expect(body.origins).toHaveLength(2);
  });

  it('parses NDJSON matrix streams', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () =>
        [
          JSON.stringify({
            originIndex: 0,
            destinationIndex: 1,
            duration: '10s',
            distanceMeters: 50,
            condition: 'ROUTE_EXISTS',
          }),
          JSON.stringify({
            originIndex: 1,
            destinationIndex: 0,
            duration: '12s',
            distanceMeters: 55,
            condition: 'ROUTE_EXISTS',
          }),
        ].join('\n'),
    });

    const matrix = await provider().getMatrix([
      { latitude: 7.064, longitude: 125.6079 },
      { latitude: 7.065, longitude: 125.608 },
    ]);
    expect(matrix.durationsSeconds[0][1]).toBe(10);
    expect(matrix.distancesMeters[1][0]).toBe(55);
    expect(matrix.durationsSeconds[0][0]).toBe(0);
  });

  it('returns GeoJSON route legs from encoded polylines', async () => {
    // Same classic sample polyline used in polyline.spec.ts
    const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            routes: [
              {
                duration: '20s',
                distanceMeters: 110,
                legs: [
                  {
                    duration: '20s',
                    distanceMeters: 110,
                    polyline: { encodedPolyline: encoded },
                  },
                ],
                polyline: { encodedPolyline: encoded },
              },
            ],
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () =>
          JSON.stringify({
            routes: [
              {
                duration: '50s',
                distanceMeters: 220,
                legs: [
                  {
                    duration: '50s',
                    distanceMeters: 220,
                    polyline: { encodedPolyline: encoded },
                  },
                ],
              },
            ],
          }),
      });

    const legs = await provider().getRoute([
      { latitude: 7.064, longitude: 125.6079 },
      { latitude: 7.0641, longitude: 125.608 },
      { latitude: 7.065, longitude: 125.609 },
    ]);

    expect(legs).toHaveLength(2);
    expect(legs[0]).toEqual(
      expect.objectContaining({
        fromIndex: 0,
        toIndex: 1,
        durationSeconds: 20,
        distanceMeters: 110,
        geometry: expect.objectContaining({
          type: 'LineString',
          coordinates: expect.any(Array),
        }),
      }),
    );
    expect(legs[0].geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    expect(legs[0].geometry.coordinates[0][0]).toBeCloseTo(-120.2, 1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://routes.googleapis.com/directions/v2:computeRoutes',
    );
  });

  it('throws routing_unavailable on HTTP errors', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, text: async () => '' });
    await expect(
      provider().getMatrix([
        { latitude: 7.064, longitude: 125.6079 },
        { latitude: 7.065, longitude: 125.608 },
      ]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws routing_unavailable for invalid points', async () => {
    await expect(provider().getMatrix([{ latitude: 7, longitude: 125 }])).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});

describe('parseGoogleDurationSeconds', () => {
  it('parses duration strings', () => {
    expect(parseGoogleDurationSeconds('20s')).toBe(20);
    expect(parseGoogleDurationSeconds('1.5s')).toBe(2);
    expect(parseGoogleDurationSeconds(30)).toBe(30);
  });

  it('rejects bad durations', () => {
    expect(() => parseGoogleDurationSeconds('nope')).toThrow(
      ServiceUnavailableException,
    );
  });
});
