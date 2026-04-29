import { Test } from '@nestjs/testing';
import { DeliverySlotsController } from './delivery-slots.controller';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySettingsService } from './delivery-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('DeliverySlotsController', () => {
  let controller: DeliverySlotsController;
  const slotsService = { getAvailability: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [DeliverySlotsController],
      providers: [
        { provide: DeliverySlotsService, useValue: slotsService },
        { provide: DeliverySettingsService, useValue: {} },
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
    expect(slotsService.getAvailability).toHaveBeenCalledWith('2026-04-30');
    expect(out).toEqual([{ templateId: 1 }]);
  });
});
