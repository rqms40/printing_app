import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PrinterProfile } from './entities/printer-profile.entity';
import { PrinterProfileService } from './printer-profile.service';

describe('PrinterProfileService', () => {
  let svc: PrinterProfileService;
  const repo = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        PrinterProfileService,
        { provide: getRepositoryToken(PrinterProfile), useValue: repo },
      ],
    }).compile();
    svc = mod.get(PrinterProfileService);
  });

  it('returns existing profile when present', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      name: 'Bambu A1 Mini',
      buildVolumeWidthMm: 180,
      buildVolumeDepthMm: 180,
      buildVolumeHeightMm: 180,
      maxFileSizeMb: 200,
    });
    const out = await svc.getProfile();
    expect(out.name).toBe('Bambu A1 Mini');
  });

  it('seeds default profile when missing', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.save.mockImplementation(async (p) => p);
    const out = await svc.getProfile();
    expect(out.name).toBe('Bambu A1 Mini');
    expect(out.buildVolumeWidthMm).toBe(180);
  });

  it('updateProfile patches and saves', async () => {
    repo.findOne.mockResolvedValue({
      id: 1,
      name: 'Old',
      buildVolumeWidthMm: 100,
      buildVolumeDepthMm: 100,
      buildVolumeHeightMm: 100,
      maxFileSizeMb: 50,
    });
    repo.save.mockImplementation(async (p) => p);
    const out = await svc.updateProfile({
      name: 'New',
      buildVolumeWidthMm: 256,
    });
    expect(out.name).toBe('New');
    expect(out.buildVolumeWidthMm).toBe(256);
    expect(out.buildVolumeDepthMm).toBe(100);
  });
});
