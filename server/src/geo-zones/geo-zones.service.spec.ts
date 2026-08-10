import { GeoZonesService } from './geo-zones.service';

const DAVAO_POLYGON = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [125.45, 7.0],
      [125.75, 7.0],
      [125.75, 7.2],
      [125.45, 7.2],
      [125.45, 7.0],
    ],
  ],
};

describe('GeoZonesService', () => {
  let service: GeoZonesService;
  let zoneRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    count: jest.Mock;
  };
  let commerceRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    zoneRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (z) => z),
      create: jest.fn((z) => z),
      count: jest.fn(),
    };
    commerceRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        defaultCommissionBps: 1500,
        defaultDeliveryFeeMinor: '2500',
        rejectOutsideZones: true,
      }),
      save: jest.fn(async (s) => s),
      create: jest.fn((s) => s),
    };
    service = new GeoZonesService(zoneRepo as any, commerceRepo as any);
  });

  it('matches points inside active zones', async () => {
    zoneRepo.find.mockResolvedValue([
      {
        id: 1,
        name: 'Davao',
        code: 'davao',
        polygon: DAVAO_POLYGON,
        baseDeliveryFeeMinor: '2500',
        isActive: true,
      },
    ]);
    const match = await service.matchPoint(7.07, 125.61);
    expect(match.inside).toBe(true);
    expect(match.zone?.code).toBe('davao');
    expect(match.deliveryFeeMinor).toBe('2500');
  });

  it('rejects points outside active zones', async () => {
    zoneRepo.find.mockResolvedValue([
      {
        id: 1,
        polygon: DAVAO_POLYGON,
        baseDeliveryFeeMinor: '2500',
        isActive: true,
      },
    ]);
    const match = await service.matchPoint(14.6, 121.0);
    expect(match.inside).toBe(false);
    expect(match.zone).toBeNull();
  });

  it('computes commission from bps', async () => {
    await expect(service.computeCommissionMinor(100_00)).resolves.toBe('1500');
  });
});
