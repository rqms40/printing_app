import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

import { StorageService } from '../storage/storage.service';
import { FileMetadata } from './entities/file-metadata.entity';
import {
  PendingFileUpload,
  PendingUploadState,
} from './entities/pending-file-upload.entity';
import {
  PendingUploadCleanupService,
  PendingUploadHandle,
} from './pending-upload-cleanup.service';

const pendingRepo = {
  create: jest.fn((value: PendingFileUpload): PendingFileUpload => value),
  save: jest.fn(
    async (value: PendingFileUpload): Promise<PendingFileUpload> => value,
  ),
  delete: jest.fn(),
  update: jest.fn(),
};

const fileRepo = { findOne: jest.fn() };
const storage = { delete: jest.fn() };
const transactionQuery = jest.fn();
const transactionPendingRepo = { delete: jest.fn() };
const transactionFileRepo = { save: jest.fn() };
const transactionManager = {
  query: transactionQuery,
  getRepository: jest.fn((entity: unknown) =>
    entity === FileMetadata ? transactionFileRepo : transactionPendingRepo,
  ),
} as unknown as EntityManager;
const dataSource = {
  transaction: jest.fn(
    async (work: (manager: EntityManager) => Promise<unknown>) =>
      work(transactionManager),
  ),
};

const handle = (
  objectKey = 'uploads/general/model.3mf',
): PendingUploadHandle => ({
  objectKey,
  uploadToken: '11111111-1111-4111-8111-111111111111',
});

const claimedRow = (
  objectKey: string,
  overrides: Record<string, unknown> = {},
) => ({
  object_key: objectKey,
  upload_token: '11111111-1111-4111-8111-111111111111',
  state: PendingUploadState.CLEANUP_PENDING,
  attempt_count: 0,
  next_attempt_at: new Date(0),
  upload_lease_expires_at: new Date(0),
  claim_token: null,
  claim_lease_expires_at: null,
  ...overrides,
});

describe('PendingUploadCleanupService lease and claim protocol', () => {
  let service: PendingUploadCleanupService;

  beforeEach(async () => {
    jest.clearAllMocks();
    pendingRepo.update.mockResolvedValue({ affected: 1 });
    pendingRepo.delete.mockResolvedValue({ affected: 1 });
    fileRepo.findOne.mockResolvedValue(null);
    storage.delete.mockResolvedValue(undefined);
    transactionPendingRepo.delete.mockResolvedValue({ affected: 1 });
    transactionFileRepo.save.mockImplementation(
      async (value: FileMetadata): Promise<FileMetadata> => value,
    );
    transactionQuery.mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        PendingUploadCleanupService,
        {
          provide: getRepositoryToken(PendingFileUpload),
          useValue: pendingRepo,
        },
        { provide: getRepositoryToken(FileMetadata), useValue: fileRepo },
        { provide: StorageService, useValue: storage },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get(PendingUploadCleanupService);
  });

  it('creates a tokenized planned row with an active upload lease', async () => {
    const before = Date.now();
    const planned = await service.plan('uploads/general/planned.3mf');

    expect(planned.objectKey).toBe('uploads/general/planned.3mf');
    expect(planned.uploadToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(pendingRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: planned.objectKey,
        uploadToken: planned.uploadToken,
        state: PendingUploadState.PLANNED,
        claimToken: null,
        claimLeaseExpiresAt: null,
        uploadLeaseExpiresAt: expect.any(Date),
      }),
    );
    expect(
      pendingRepo.save.mock.calls[0][0].uploadLeaseExpiresAt.getTime(),
    ).toBeGreaterThan(before);
  });

  it('renews the ownership lease while a slow storage upload is running', async () => {
    jest.useFakeTimers();
    let finishUpload!: () => void;
    const upload = service.withUploadLeaseHeartbeat(
      handle(),
      () =>
        new Promise<string>((resolve) => {
          finishUpload = () => resolve('stored');
        }),
    );

    await jest.advanceTimersByTimeAsync(25_000);
    expect(pendingRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: handle().objectKey,
        uploadToken: handle().uploadToken,
        state: PendingUploadState.PLANNED,
      }),
      expect.objectContaining({ uploadLeaseExpiresAt: expect.any(Date) }),
    );
    finishUpload();
    await expect(upload).resolves.toBe('stored');
    jest.useRealTimers();
  });

  it('finalizes metadata and pending rows in one transaction while ownership is valid', async () => {
    const owned = handle();
    const metadata = { objectKey: owned.objectKey } as FileMetadata;
    transactionQuery.mockResolvedValue([
      claimedRow(owned.objectKey, {
        state: PendingUploadState.PLANNED,
        upload_lease_expires_at: new Date(Date.now() + 60_000),
      }),
    ]);

    await expect(service.finalizeUpload(metadata, [owned])).resolves.toBe(
      metadata,
    );
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(transactionFileRepo.save).toHaveBeenCalledWith(metadata);
    expect(transactionPendingRepo.delete).toHaveBeenCalledWith({
      objectKey: owned.objectKey,
      uploadToken: owned.uploadToken,
      state: PendingUploadState.PLANNED,
    });
  });

  it('refuses uploader finalization after cleanup has claimed the object', async () => {
    const owned = handle();
    transactionQuery.mockResolvedValue([
      claimedRow(owned.objectKey, {
        state: PendingUploadState.DELETING,
        claim_token: '22222222-2222-4222-8222-222222222222',
        claim_lease_expires_at: new Date(Date.now() + 60_000),
      }),
    ]);

    await expect(
      service.finalizeUpload({ objectKey: owned.objectKey } as FileMetadata, [
        owned,
      ]),
    ).rejects.toThrow(ConflictException);
    expect(transactionFileRepo.save).not.toHaveBeenCalled();
  });

  it('leaves no cleanup claim after uploader finalization wins the row lock', async () => {
    const owned = handle();
    transactionQuery
      .mockResolvedValueOnce([
        claimedRow(owned.objectKey, {
          state: PendingUploadState.PLANNED,
          upload_lease_expires_at: new Date(Date.now() + 60_000),
        }),
      ])
      .mockResolvedValueOnce([]);

    await service.finalizeUpload(
      { objectKey: owned.objectKey } as FileMetadata,
      [owned],
    );
    await expect(service.retryDue(new Date())).resolves.toEqual({
      found: 0,
      deleted: 0,
      committed: 0,
      failed: 0,
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('recreates a cleanup row when a worker cleared the plan before a late upload finished', async () => {
    transactionQuery.mockResolvedValue([]);
    pendingRepo.update.mockResolvedValue({ affected: 0 });

    await service.queueCleanupAndReconcile(
      [handle('uploads/general/late-write.3mf')],
      new Error('upload lease lost'),
    );

    expect(transactionQuery.mock.calls[0][0]).toContain(
      'INSERT INTO "pending_file_uploads"',
    );
    expect(transactionQuery.mock.calls[0][0]).toContain(
      'ON CONFLICT DO NOTHING',
    );
  });

  it('claims due work with SKIP LOCKED before checking metadata or deleting storage', async () => {
    transactionQuery
      .mockResolvedValueOnce([
        claimedRow('uploads/general/orphan.obj', {
          state: PendingUploadState.CLEANUP_PENDING,
        }),
      ])
      .mockResolvedValue([]);

    await expect(service.retryDue(new Date())).resolves.toEqual({
      found: 1,
      deleted: 1,
      committed: 0,
      failed: 0,
    });
    expect(transactionQuery.mock.calls[0][0]).toContain(
      'FOR UPDATE SKIP LOCKED',
    );
    expect(transactionQuery.mock.invocationCallOrder[1]).toBeLessThan(
      fileRepo.findOne.mock.invocationCallOrder[0],
    );
    expect(fileRepo.findOne.mock.invocationCallOrder[0]).toBeLessThan(
      storage.delete.mock.invocationCallOrder[0],
    );
  });

  it('lets only one of two workers claim the same due row', async () => {
    transactionQuery
      .mockResolvedValueOnce([claimedRow('uploads/general/once.obj')])
      .mockResolvedValueOnce([])
      .mockResolvedValue([]);

    const results = await Promise.all([
      service.retryDue(new Date()),
      service.retryDue(new Date()),
    ]);

    expect(results.reduce((sum, result) => sum + result.found, 0)).toBe(1);
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });

  it('reclaims a deleting row only after its claim lease expired', async () => {
    transactionQuery
      .mockResolvedValueOnce([
        claimedRow('uploads/general/crashed.obj', {
          state: PendingUploadState.DELETING,
          claim_token: '22222222-2222-4222-8222-222222222222',
          claim_lease_expires_at: new Date(0),
        }),
      ])
      .mockResolvedValue([]);

    await expect(service.retryDue(new Date())).resolves.toEqual(
      expect.objectContaining({ found: 1, deleted: 1 }),
    );
    expect(transactionQuery.mock.calls[0][0]).toContain(`"state" = 'deleting'`);
    expect(transactionQuery.mock.calls[0][0]).toContain(
      'claim_lease_expires_at',
    );
  });

  it('does not clear a deleting job when its claim token changed', async () => {
    transactionQuery
      .mockResolvedValueOnce([claimedRow('uploads/general/stolen.obj')])
      .mockResolvedValue([]);
    pendingRepo.delete.mockResolvedValue({ affected: 0 });

    await expect(service.retryDue(new Date())).resolves.toEqual(
      expect.objectContaining({ found: 1, failed: 1 }),
    );
    expect(pendingRepo.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: 'uploads/general/stolen.obj',
        state: PendingUploadState.DELETING,
        claimToken: expect.any(String),
      }),
    );
  });

  it('returns a failed deletion claim to token-guarded retry state', async () => {
    transactionQuery
      .mockResolvedValueOnce([claimedRow('uploads/general/retry.obj')])
      .mockResolvedValue([]);
    storage.delete.mockRejectedValue(new Error('MinIO unavailable'));

    await expect(service.retryDue(new Date())).resolves.toEqual(
      expect.objectContaining({ found: 1, failed: 1 }),
    );
    expect(pendingRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: 'uploads/general/retry.obj',
        state: PendingUploadState.DELETING,
        claimToken: expect.any(String),
      }),
      expect.objectContaining({
        state: PendingUploadState.CLEANUP_PENDING,
        claimToken: null,
        claimLeaseExpiresAt: null,
        lastError: 'MinIO unavailable',
      }),
    );
  });

  it('clears committed metadata without deleting the claimed object', async () => {
    transactionQuery
      .mockResolvedValueOnce([claimedRow('uploads/general/committed.pdf')])
      .mockResolvedValue([]);
    fileRepo.findOne.mockResolvedValue({
      objectKey: 'uploads/general/committed.pdf',
    });

    await expect(service.retryDue(new Date())).resolves.toEqual(
      expect.objectContaining({ found: 1, committed: 1, deleted: 0 }),
    );
    expect(storage.delete).not.toHaveBeenCalled();
  });
});
