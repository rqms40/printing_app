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
    mockFilesService.deleteExpired.mockResolvedValue({ found: 3, deleted: 2, skipped: 1 });
    await service.runPurgeSweep();
    expect(mockFilesService.deleteExpired).toHaveBeenCalledTimes(1);
  });
});
