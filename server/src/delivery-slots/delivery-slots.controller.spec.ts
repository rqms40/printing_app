import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeliverySlotsController } from './delivery-slots.controller';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySettingsService } from './delivery-settings.service';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('DeliverySlotsController', () => {
  let controller: DeliverySlotsController;
  const slotsService = { getAvailability: jest.fn() };
  const settingsService = {
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [DeliverySlotsController],
      providers: [
        { provide: DeliverySlotsService, useValue: slotsService },
        { provide: DeliverySettingsService, useValue: settingsService },
        {
          provide: getRepositoryToken(DeliverySlotTemplate),
          useValue: { find: jest.fn(), save: jest.fn(), create: jest.fn() },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = mod.get(DeliverySlotsController);
  });

  it('GET /delivery-slots returns availability for date', async () => {
    slotsService.getAvailability.mockResolvedValue([{ templateId: 1 }]);
    const out = await controller.list('2026-04-30');
    expect(slotsService.getAvailability).toHaveBeenCalledWith('2026-04-30', {
      pickupOnly: false,
    });
    expect(out).toEqual([{ templateId: 1 }]);
  });

  it('GET /delivery-settings returns client fee fields from admin settings', async () => {
    settingsService.getSettings.mockResolvedValue({
      deliveryFeePerKm: '100.00',
      priorityFeeAmount: '50.00',
      extraDestinationSurcharge: '30.00',
      serviceFeePercent: '10.00',
    });
    const out = await controller.getClientFeeSettings();
    expect(out).toEqual({
      deliveryFeePerKm: 100,
      priorityFeeAmount: 50,
      extraDestinationSurcharge: 30,
      serviceFeePercent: 10,
    });
  });

  describe('admin endpoints', () => {
    const tplRepo = { find: jest.fn(), save: jest.fn(), create: jest.fn() };
    const settingsService = {
      getSettings: jest.fn(),
      updateSettings: jest.fn(),
    };
    let adminController: DeliverySlotsController;

    beforeEach(async () => {
      jest.clearAllMocks();
      const mod = await Test.createTestingModule({
        controllers: [DeliverySlotsController],
        providers: [
          { provide: DeliverySlotsService, useValue: slotsService },
          { provide: DeliverySettingsService, useValue: settingsService },
          {
            provide: getRepositoryToken(DeliverySlotTemplate),
            useValue: tplRepo,
          },
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();
      adminController = mod.get(DeliverySlotsController);
    });

    it('GET /admin/delivery-slot-templates returns full list', async () => {
      tplRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const out = await adminController.adminListTemplates();
      expect(out).toHaveLength(2);
    });

    it('GET /admin/settings/delivery returns settings', async () => {
      settingsService.getSettings.mockResolvedValue({ id: 1 });
      const out = await adminController.adminGetSettings();
      expect(out).toEqual({ id: 1 });
    });
  });
});
