import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PurgeService } from './purge.service';
import { FilesService } from './files.service';

describe('PurgeService', () => {
  let service: PurgeService;
  const mockFilesService = {
    deleteExpired: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurgeService,
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();
    service = module.get<PurgeService>(PurgeService);
  });

  it('runPurgeSweep calls deleteExpired and logs summary', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    mockFilesService.deleteExpired.mockResolvedValue({
      found: 4,
      deleted: 2,
      skipped: 1,
      failed: 1,
    });
    await service.runPurgeSweep();
    expect(mockFilesService.deleteExpired).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      'Purge sweep complete: 2 deleted, 1 failed, 1 skipped of 4 found',
    );
    log.mockRestore();
  });
});
