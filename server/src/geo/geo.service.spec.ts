import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeoService } from './geo.service';

describe('GeoService', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
  });

  function service(env: Record<string, string> = {}) {
    return new GeoService(
      new ConfigService({
        GOOGLE_MAPS_API: 'test-key',
        GRIDGO_STORE_LATITUDE: '7.064',
        GRIDGO_STORE_LONGITUDE: '125.6079',
        ...env,
      }),
    ).useFetchImpl(fetchMock);
  }

  it('throws geo_unavailable without API key', async () => {
    const bare = new GeoService(new ConfigService({})).useFetchImpl(fetchMock);
    await expect(bare.reverseGeocode(7.07, 125.61)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('reverse geocodes a pin', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [
          {
            formatted_address: 'Davao City, Philippines',
            place_id: 'abc',
            geometry: { location: { lat: 7.07, lng: 125.61 } },
            address_components: [
              { long_name: 'Davao City', types: ['locality'] },
              { long_name: 'Philippines', types: ['country'] },
            ],
          },
        ],
      }),
    });

    await expect(service().reverseGeocode(7.07, 125.61)).resolves.toEqual(
      expect.objectContaining({
        formattedAddress: 'Davao City, Philippines',
        placeId: 'abc',
        components: expect.objectContaining({ city: 'Davao City' }),
      }),
    );
    expect(String(fetchMock.mock.calls[0][0])).toContain('geocode/json');
  });

  it('returns autocomplete suggestions biased to PH', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'OK',
        predictions: [
          {
            place_id: 'p1',
            description: 'SM Lanang, Davao City',
            structured_formatting: {
              main_text: 'SM Lanang',
              secondary_text: 'Davao City',
            },
          },
        ],
      }),
    });

    const suggestions = await service().autocomplete('SM Lanang');
    expect(suggestions).toEqual([
      {
        placeId: 'p1',
        description: 'SM Lanang, Davao City',
        mainText: 'SM Lanang',
        secondaryText: 'Davao City',
      },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toContain('components=country%3Aph');
  });

  it('rejects invalid coordinates', async () => {
    await expect(service().reverseGeocode(999, 0)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
