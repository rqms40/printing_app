import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OsrmRoutingProvider } from './osrm-routing.provider';

describe('OsrmRoutingProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  function provider() {
    return new OsrmRoutingProvider(
      new ConfigService({
        ROUTING_BASE_URL: 'http://routing.test',
        ROUTING_PROFILE: 'driving',
        ROUTING_TIMEOUT_MS: '250',
      }),
      fetchMock,
    );
  }

  it('requests a duration/distance matrix with longitude before latitude', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        durations: [
          [0, 20],
          [22, 0],
        ],
        distances: [
          [0, 110],
          [115, 0],
        ],
      }),
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
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://routing.test/table/v1/driving/125.6079,7.064;125.6079,7.0641?annotations=duration%2Cdistance',
    );
  });

  it('returns GeoJSON route legs', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [
            {
              legs: [{ duration: 20, distance: 110 }],
              geometry: {
                type: 'LineString',
                coordinates: [
                  [125.6079, 7.064],
                  [125.608, 7.0641],
                ],
              },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 'Ok',
          routes: [
            {
              legs: [{ duration: 50, distance: 220 }],
              geometry: {
                type: 'LineString',
                coordinates: [
                  [125.608, 7.0641],
                  [125.6085, 7.0645],
                  [125.609, 7.065],
                ],
              },
            },
          ],
        }),
      });

    await expect(
      provider().getRoute([
        { latitude: 7.064, longitude: 125.6079 },
        { latitude: 7.0641, longitude: 125.608 },
        { latitude: 7.065, longitude: 125.609 },
      ]),
    ).resolves.toEqual([
      expect.objectContaining({
        fromIndex: 0,
        toIndex: 1,
        durationSeconds: 20,
        distanceMeters: 110,
        geometry: {
          type: 'LineString',
          coordinates: [
            [125.6079, 7.064],
            [125.608, 7.0641],
          ],
        },
      }),
      expect.objectContaining({
        fromIndex: 1,
        toIndex: 2,
        durationSeconds: 50,
        distanceMeters: 220,
        geometry: {
          type: 'LineString',
          coordinates: [
            [125.608, 7.0641],
            [125.6085, 7.0645],
            [125.609, 7.065],
          ],
        },
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain(
      '?geometries=geojson&overview=full&steps=false',
    );
    expect(fetchMock.mock.calls[0][0]).toContain(
      '125.6079,7.064;125.608,7.0641',
    );
    expect(fetchMock.mock.calls[1][0]).toContain(
      '125.608,7.0641;125.609,7.065',
    );
  });

  it.each([
    ['non-ok response', { ok: false, status: 503, json: async () => ({}) }],
    [
      'malformed matrix',
      {
        ok: true,
        json: async () => ({
          code: 'Ok',
          durations: [[0]],
          distances: [[0]],
        }),
      },
    ],
    [
      'invalid numeric cell',
      {
        ok: true,
        json: async () => ({
          code: 'Ok',
          durations: [
            [0, -1],
            [2, 0],
          ],
          distances: [
            [0, 1],
            [2, 0],
          ],
        }),
      },
    ],
  ])('fails closed for a %s', async (_label, response) => {
    fetchMock.mockResolvedValue(response);
    await expect(
      provider().getMatrix([
        { latitude: 7.064, longitude: 125.6079 },
        { latitude: 7.065, longitude: 125.609 },
      ]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'routing_unavailable' }),
    });
  });

  it('preserves unreachable null cells for the solver to reject', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        durations: [
          [0, null],
          [null, 0],
        ],
        distances: [
          [0, null],
          [null, 0],
        ],
      }),
    });
    await expect(
      provider().getMatrix([
        { latitude: 7.064, longitude: 125.6079 },
        { latitude: 7.065, longitude: 125.609 },
      ]),
    ).resolves.toEqual({
      durationsSeconds: [
        [0, null],
        [null, 0],
      ],
      distancesMeters: [
        [0, null],
        [null, 0],
      ],
    });
  });

  it.each([
    ['provider code', { code: 'NoRoute', routes: [] }],
    ['missing geometry', { code: 'Ok', routes: [{ legs: [{}] }] }],
    [
      'out-of-range geometry',
      {
        code: 'Ok',
        routes: [
          {
            legs: [{ duration: 1, distance: 2 }],
            geometry: {
              type: 'LineString',
              coordinates: [
                [200, 7],
                [125, 7],
              ],
            },
          },
        ],
      },
    ],
  ])('fails closed for malformed route: %s', async (_label, payload) => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => payload });
    await expect(
      provider().getRoute([
        { latitude: 7.064, longitude: 125.6079 },
        { latitude: 7.065, longitude: 125.609 },
      ]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'routing_unavailable' }),
    });
  });

  it('converts provider timeouts to routing_unavailable', async () => {
    fetchMock.mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(
      provider().getMatrix([
        { latitude: 7.064, longitude: 125.6079 },
        { latitude: 7.065, longitude: 125.609 },
      ]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
