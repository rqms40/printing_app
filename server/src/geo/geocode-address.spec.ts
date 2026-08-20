import {
  geocodeAddress,
  normalizeShopQuery,
  searchShopAddresses,
} from './geocode-address';

const photonHit = {
  features: [
    {
      geometry: { coordinates: [125.5889, 7.0505] },
      properties: {
        name: 'Quimpo Blvd',
        city: 'Davao City',
        countrycode: 'PH',
      },
    },
    {
      geometry: { coordinates: [125.6146, 7.0876] },
      properties: {
        street: 'New Burgos Street',
        district: 'Barrio Obrero',
        city: 'Davao City',
        countrycode: 'PH',
      },
    },
  ],
};

describe('normalizeShopQuery', () => {
  it('rejects empty queries', () => {
    expect(normalizeShopQuery('  ')).toBeNull();
  });

  it('appends Davao City when the query has no region hint', () => {
    expect(normalizeShopQuery('123 Quimpo Blvd')).toBe(
      '123 Quimpo Blvd, Davao City, Philippines',
    );
  });

  it('keeps queries that already mention Davao', () => {
    expect(normalizeShopQuery('Quimpo Blvd, Ecoland, Davao City')).toBe(
      'Quimpo Blvd, Ecoland, Davao City',
    );
  });
});

describe('searchShopAddresses', () => {
  it('returns OpenStreetMap place suggestions from Photon', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => photonHit,
    });

    await expect(searchShopAddresses('Quimpo', 6, fetchImpl)).resolves.toEqual([
      {
        latitude: 7.0505,
        longitude: 125.5889,
        displayName: 'Quimpo Blvd, Davao City',
      },
      {
        latitude: 7.0876,
        longitude: 125.6146,
        displayName: 'New Burgos Street, Barrio Obrero, Davao City',
      },
    ]);
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain('photon.komoot.io');
    expect(calledUrl).toContain('lat=7.0731');
  });

  it('returns an empty list when Photon has no hits', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    });
    await expect(
      searchShopAddresses('unknown alley nowhere', 6, fetchImpl),
    ).resolves.toEqual([]);
  });
});

describe('geocodeAddress', () => {
  it('returns the first Photon hit', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => photonHit,
    });

    await expect(
      geocodeAddress('Quimpo Blvd, Ecoland, Davao City', fetchImpl),
    ).resolves.toEqual({
      latitude: 7.0505,
      longitude: 125.5889,
      displayName: 'Quimpo Blvd, Davao City',
    });
  });
});
