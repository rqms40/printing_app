import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { StorageService } from '../storage/storage.service';
import { FileMetadata } from './entities/file-metadata.entity';
import {
  PendingFileUpload,
  PendingUploadState,
} from './entities/pending-file-upload.entity';
import { PendingUploadCleanupService } from './pending-upload-cleanup.service';

const pendingRepo = {
  create: jest.fn((value: PendingFileUpload): PendingFileUpload => value),
  save: jest.fn(
    async (value: PendingFileUpload): Promise<PendingFileUpload> => value,
  ),
  find: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
};

const fileRepo = {
  findOne: jest.fn(),
};

const storage = {
  delete: jest.fn(),
};

const pending = (
  objectKey: string,
  overrides: Partial<PendingFileUpload> = {},
): PendingFileUpload =>
  ({
    objectKey,
    state: PendingUploadState.CLEANUP_PENDING,
    attemptCount: 0,
    lastError: null,
    nextAttemptAt: new Date(0),
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  }) as PendingFileUpload;

describe('PendingUploadCleanupService', () => {
  let service: PendingUploadCleanupService;

  beforeEach(async () => {
    jest.clearAllMocks();
    pendingRepo.find.mockResolvedValue([]);
    fileRepo.findOne.mockResolvedValue(null);
    storage.delete.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        PendingUploadCleanupService,
        {
          provide: getRepositoryToken(PendingFileUpload),
          useValue: pendingRepo,
        },
        { provide: getRepositoryToken(FileMetadata), useValue: fileRepo },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();
    service = module.get(PendingUploadCleanupService);
  });

  it('durably records a planned key before its object upload can begin', async () => {
    const before = Date.now();

    await service.plan('uploads/general/planned.3mf');

    expect(pendingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: 'uploads/general/planned.3mf',
        state: PendingUploadState.PLANNED,
        attemptCount: 0,
        nextAttemptAt: expect.any(Date),
      }),
    );
    expect(
      pendingRepo.save.mock.calls[0][0].nextAttemptAt.getTime(),
    ).toBeGreaterThanOrEqual(before + 14 * 60 * 1000);
  });

  it('reconciles original and preview keys and removes jobs only after deletion', async () => {
    await service.queueCleanupAndReconcile(
      [
        'uploads/general/original.stl',
        'uploads/general/original.stl.preview.glb',
      ],
      new Error('save failed'),
    );

    expect(storage.delete.mock.calls.map(([key]) => String(key))).toEqual([
      'uploads/general/original.stl.preview.glb',
      'uploads/general/original.stl',
    ]);
    expect(pendingRepo.delete.mock.calls.map(([key]) => String(key))).toEqual([
      'uploads/general/original.stl.preview.glb',
      'uploads/general/original.stl',
    ]);
  });

  it('retains and increments a job when metadata reconciliation is unavailable', async () => {
    fileRepo.findOne.mockRejectedValue(new Error('database unavailable'));

    await service.queueCleanupAndReconcile(
      ['uploads/general/ambiguous.3mf'],
      new Error('save outcome unknown'),
    );

    expect(storage.delete).not.toHaveBeenCalled();
    expect(pendingRepo.delete).not.toHaveBeenCalled();
    expect(pendingRepo.update).toHaveBeenCalledWith(
      { objectKey: 'uploads/general/ambiguous.3mf' },
      expect.objectContaining({
        state: PendingUploadState.CLEANUP_PENDING,
        attemptCount: expect.any(Function),
        lastError: expect.stringContaining('database unavailable'),
      }),
    );
  });

  it('retains and increments a job when object deletion fails', async () => {
    storage.delete.mockRejectedValue(new Error('MinIO unavailable'));

    await service.queueCleanupAndReconcile(
      ['uploads/general/orphan.obj'],
      new Error('save failed'),
    );

    expect(pendingRepo.delete).not.toHaveBeenCalled();
    expect(pendingRepo.update).toHaveBeenCalledWith(
      { objectKey: 'uploads/general/orphan.obj' },
      expect.objectContaining({
        attemptCount: expect.any(Function),
        lastError: expect.stringContaining('MinIO unavailable'),
      }),
    );
  });

  it('retries a retained orphan and clears the job after successful deletion', async () => {
    pendingRepo.find.mockResolvedValue([
      pending('uploads/general/retry.obj', { attemptCount: 2 }),
    ]);

    await expect(service.retryDue(new Date())).resolves.toEqual({
      found: 1,
      deleted: 1,
      committed: 0,
      failed: 0,
    });
    expect(storage.delete).toHaveBeenCalledWith('uploads/general/retry.obj');
    expect(pendingRepo.delete).toHaveBeenCalledWith(
      'uploads/general/retry.obj',
    );
  });

  it.each([
    [
      'original',
      'uploads/general/committed.pdf',
      { objectKey: 'uploads/general/committed.pdf' },
    ],
    [
      'preview',
      'uploads/general/model.stl.preview.glb',
      { previewGlbObjectKey: 'uploads/general/model.stl.preview.glb' },
    ],
  ])(
    'clears a %s job without deleting an object referenced by committed metadata',
    async (_case, objectKey, metadata) => {
      pendingRepo.find.mockResolvedValue([pending(objectKey)]);
      fileRepo.findOne.mockResolvedValue(metadata);

      await expect(service.retryDue(new Date())).resolves.toEqual({
        found: 1,
        deleted: 0,
        committed: 1,
        failed: 0,
      });
      expect(storage.delete).not.toHaveBeenCalled();
      expect(pendingRepo.delete).toHaveBeenCalledWith(objectKey);
      expect(fileRepo.findOne).toHaveBeenCalledWith({
        where: [{ objectKey }, { previewGlbObjectKey: objectKey }],
      });
    },
  );

  it('logs and leaves a planned job when completion cannot clear it', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    pendingRepo.delete.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.complete(['uploads/general/committed.pdf']),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('uploads/general/committed.pdf'),
    );
    error.mockRestore();
  });
});
