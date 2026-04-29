import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeliverySettings } from './entities/delivery-settings.entity';
import { DeliverySettingsService } from './delivery-settings.service';
import { GeoRadiusService } from './geo-radius.service';

describe('DeliverySettingsService', () => {
  let svc: DeliverySettingsService;
  const repo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        DeliverySettingsService,
        GeoRadiusService,
        { provide: getRepositoryToken(DeliverySettings), useValue: repo },
      ],
    }).compile();
    svc = mod.get(DeliverySettingsService);
  });

  it('returns existing settings row', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      serviceCenterLat: 7.07,
      serviceCenterLng: 125.61,
      serviceRadiusKm: 25,
      priorityFeeAmount: 50,
      extraDestinationSurcharge: 30,
    });
    const out = await svc.getSettings();
    expect(out.serviceRadiusKm).toBe(25);
  });

  it('isInsideServiceArea uses live settings', async () => {
    repo.findOne.mockResolvedValue({
      serviceCenterLat: 7.07,
      serviceCenterLng: 125.61,
      serviceRadiusKm: 25,
    });
    expect(await svc.isInsideServiceArea(7.07, 125.61)).toBe(true);
    expect(await svc.isInsideServiceArea(8.5, 125.6)).toBe(false);
    expect(await svc.isInsideServiceArea(null, null)).toBe(false);
  });
});
