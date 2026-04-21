import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FilesService } from './files.service';
import { FileMetadata } from './entities/file-metadata.entity';
import { StorageService } from '../storage/storage.service';

describe('FilesService', () => {
  let service: FilesService;
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const storageService = {
    upload: jest.fn(),
    getPresignedUrl: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: getRepositoryToken(FileMetadata), useValue: repo },
        { provide: StorageService, useValue: storageService },
      ],
    }).compile();
    service = module.get<FilesService>(FilesService);
  });

  describe('stampExpiry', () => {
    it('sets expiresAt to now + retentionDays on the file row', async () => {
      repo.update.mockResolvedValue({});
      const before = new Date();
      await service.stampExpiry(5, 7);
      const after = new Date();

      expect(repo.update).toHaveBeenCalledTimes(1);
      const [id, payload] = repo.update.mock.calls[0];
      expect(id).toBe(5);
      const expiresAt: Date = payload.expiresAt;
      const diffMs = expiresAt.getTime() - before.getTime();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(diffMs).toBeGreaterThanOrEqual(sevenDaysMs - 1000);
      expect(diffMs).toBeLessThanOrEqual(sevenDaysMs + (after.getTime() - before.getTime()) + 1000);
    });
  });

  describe('deleteExpired', () => {
    it('deletes MinIO objects and db rows for expired files', async () => {
      const fakeQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 1, objectKey: 'key/a.pdf', expiresAt: new Date(Date.now() - 1000) },
          { id: 2, objectKey: 'key/b.pdf', expiresAt: new Date(Date.now() - 1000) },
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(fakeQb);
      storageService.delete.mockResolvedValue(undefined);
      repo.delete.mockResolvedValue({});

      const result = await service.deleteExpired();

      expect(storageService.delete).toHaveBeenCalledTimes(2);
      expect(repo.delete).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ found: 2, deleted: 2, skipped: 0 });
    });

    it('skips a record when MinIO deletion fails', async () => {
      const fakeQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 1, objectKey: 'key/a.pdf', expiresAt: new Date(Date.now() - 1000) },
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(fakeQb);
      storageService.delete.mockRejectedValue(new Error('MinIO down'));
      repo.delete.mockResolvedValue({});

      const result = await service.deleteExpired();

      expect(repo.delete).not.toHaveBeenCalled();
      expect(result).toEqual({ found: 1, deleted: 0, skipped: 1 });
    });

    it('deletes db row even when objectKey is null', async () => {
      const fakeQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 3, objectKey: null, expiresAt: new Date(Date.now() - 1000) },
        ]),
      };
      repo.createQueryBuilder.mockReturnValue(fakeQb);
      repo.delete.mockResolvedValue({});

      const result = await service.deleteExpired();

      expect(storageService.delete).not.toHaveBeenCalled();
      expect(repo.delete).toHaveBeenCalledWith(3);
      expect(result).toEqual({ found: 1, deleted: 1, skipped: 0 });
    });
  });

  describe('getMyUploads', () => {
    it('uses two-branch OR where clause to exclude expired files', async () => {
      repo.find.mockResolvedValue([]);
      await service.getMyUploads(7);

      const whereArg = repo.find.mock.calls[0][0].where;
      expect(Array.isArray(whereArg)).toBe(true);
      expect(whereArg).toHaveLength(2);
    });
  });
});
