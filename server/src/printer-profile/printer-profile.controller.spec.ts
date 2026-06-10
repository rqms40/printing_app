import { Test } from '@nestjs/testing';
import { PrinterProfileController } from './printer-profile.controller';
import { PrinterProfileService } from './printer-profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

describe('PrinterProfileController', () => {
  let ctrl: PrinterProfileController;
  const service = { getProfile: jest.fn(), updateProfile: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      controllers: [PrinterProfileController],
      providers: [{ provide: PrinterProfileService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    ctrl = mod.get(PrinterProfileController);
  });

  it('GET /printer-profile returns the profile', async () => {
    service.getProfile.mockResolvedValue({ id: 1, name: 'Bambu A1 Mini' });
    expect(await ctrl.getCustomer()).toEqual({ id: 1, name: 'Bambu A1 Mini' });
  });

  it('PATCH /admin/printer-profile updates', async () => {
    service.updateProfile.mockResolvedValue({ id: 1, name: 'New' });
    expect(await ctrl.adminUpdate({ name: 'New' })).toEqual({
      id: 1,
      name: 'New',
    });
  });
});
