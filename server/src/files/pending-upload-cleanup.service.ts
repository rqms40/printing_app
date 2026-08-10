import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { StorageService } from '../storage/storage.service';
import { FileMetadata } from './entities/file-metadata.entity';
import {
  PendingFileUpload,
  PendingUploadState,
} from './entities/pending-file-upload.entity';

const UPLOAD_LEASE_MS = 60_000;
const UPLOAD_HEARTBEAT_MS = 20_000;
const CLAIM_LEASE_MS = 2 * 60_000;
const CLAIM_HEARTBEAT_MS = 30_000;
const RETRY_DELAY_MS = 15 * 60_000;
const RETRY_BATCH_SIZE = 100;

export type PendingUploadHandle = {
  objectKey: string;
  uploadToken: string;
};

type CleanupClaim = {
  objectKey: string;
  claimToken: string;
};

type PendingRow = {
  object_key: string;
  upload_token: string;
  state: PendingUploadState;
  upload_lease_expires_at: Date | string;
};

export type PendingUploadRetryResult = {
  found: number;
  deleted: number;
  committed: number;
  failed: number;
};

@Injectable()
export class PendingUploadCleanupService {
  private readonly logger = new Logger(PendingUploadCleanupService.name);

  constructor(
    @InjectRepository(PendingFileUpload)
    private readonly pendingRepo: Repository<PendingFileUpload>,
    @InjectRepository(FileMetadata)
    private readonly fileRepo: Repository<FileMetadata>,
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  async plan(objectKey: string): Promise<PendingUploadHandle> {
    const uploadToken = randomUUID();
    const job = this.pendingRepo.create({
      objectKey,
      uploadToken,
      uploadLeaseExpiresAt: new Date(Date.now() + UPLOAD_LEASE_MS),
      state: PendingUploadState.PLANNED,
      claimToken: null,
      claimLeaseExpiresAt: null,
      attemptCount: 0,
      lastError: null,
      nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
    });
    await this.pendingRepo.save(job);
    return { objectKey, uploadToken };
  }

  async withUploadLeaseHeartbeat<T>(
    handle: PendingUploadHandle,
    operation: () => Promise<T>,
  ): Promise<T> {
    let leaseError: unknown;
    let renewals = Promise.resolve();
    const heartbeat = setInterval(() => {
      renewals = renewals
        .then(() => this.renewUploadLease(handle))
        .catch((error: unknown) => {
          leaseError = error;
        });
    }, UPLOAD_HEARTBEAT_MS);
    heartbeat.unref?.();
    try {
      const result = await operation();
      await renewals;
      if (leaseError) {
        throw leaseError instanceof Error
          ? leaseError
          : new Error(this.errorMessage(leaseError));
      }
      await this.renewUploadLease(handle);
      return result;
    } finally {
      clearInterval(heartbeat);
    }
  }

  async finalizeUpload(
    metadata: FileMetadata,
    handles: PendingUploadHandle[],
  ): Promise<FileMetadata> {
    if (handles.length < 1)
      throw new ConflictException('Upload ownership lost');
    const ordered = [...handles].sort((left, right) =>
      left.objectKey.localeCompare(right.objectKey),
    );
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<PendingRow[]>(
        `
          SELECT
            "object_key",
            "upload_token",
            "state",
            "upload_lease_expires_at"
          FROM "pending_file_uploads"
          WHERE "object_key" = ANY($1::varchar[])
          ORDER BY "object_key"
          FOR UPDATE
        `,
        [ordered.map((handle) => handle.objectKey)],
      );
      const byKey = new Map(rows.map((row) => [row.object_key, row]));
      const now = Date.now();
      if (
        rows.length !== ordered.length ||
        ordered.some((handle) => {
          const row = byKey.get(handle.objectKey);
          return (
            !row ||
            row.upload_token !== handle.uploadToken ||
            row.state !== PendingUploadState.PLANNED ||
            new Date(row.upload_lease_expires_at).getTime() <= now
          );
        })
      ) {
        throw new ConflictException('Upload ownership lost');
      }

      const saved = await manager.getRepository(FileMetadata).save(metadata);
      const pendingRepository = manager.getRepository(PendingFileUpload);
      for (const handle of ordered) {
        const deleted = await pendingRepository.delete({
          objectKey: handle.objectKey,
          uploadToken: handle.uploadToken,
          state: PendingUploadState.PLANNED,
        });
        if (deleted.affected !== 1) {
          throw new ConflictException('Upload ownership lost');
        }
      }
      return saved;
    });
  }

  async queueCleanupAndReconcile(
    handles: PendingUploadHandle[],
    cause: unknown,
  ): Promise<void> {
    for (const handle of [...handles].reverse()) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const now = new Date();
          const error = this.errorMessage(cause).slice(0, 4000);
          await manager.query(
            `
              INSERT INTO "pending_file_uploads" (
                "object_key",
                "state",
                "upload_token",
                "upload_lease_expires_at",
                "claim_token",
                "claim_lease_expires_at",
                "attempt_count",
                "last_error",
                "next_attempt_at"
              )
              VALUES ($1, 'cleanup_pending', $2, $3, NULL, NULL, 0, $4, $3)
              ON CONFLICT DO NOTHING
            `,
            [handle.objectKey, handle.uploadToken, now, error],
          );
          await manager.query(
            `
              UPDATE "pending_file_uploads"
              SET
                "state" = 'cleanup_pending',
                "last_error" = $3,
                "next_attempt_at" = $4,
                "updated_at" = now()
              WHERE
                "object_key" = $1
                AND "upload_token" = $2
                AND "state" IN ('planned', 'cleanup_pending')
            `,
            [handle.objectKey, handle.uploadToken, error, now],
          );
        });
      } catch (error) {
        this.logger.error(
          `Could not queue upload cleanup for ${handle.objectKey} (${this.errorMessage(error)})`,
        );
      }
    }
    try {
      await this.retryDue(new Date());
    } catch (error) {
      this.logger.error(
        `Immediate upload cleanup reconciliation failed (${this.errorMessage(error)})`,
      );
    }
  }

  async retryDue(now = new Date()): Promise<PendingUploadRetryResult> {
    const claims = await this.claimDue(now);
    const result: PendingUploadRetryResult = {
      found: claims.length,
      deleted: 0,
      committed: 0,
      failed: 0,
    };
    for (const claim of claims) {
      const outcome = await this.withClaimLeaseHeartbeat(claim, () =>
        this.reconcileClaim(claim),
      ).catch(async (error: unknown) => {
        await this.releaseClaim(claim, error);
        return 'failed' as const;
      });
      result[outcome] += 1;
    }
    return result;
  }

  private async renewUploadLease(handle: PendingUploadHandle): Promise<void> {
    const result = await this.pendingRepo.update(
      {
        objectKey: handle.objectKey,
        uploadToken: handle.uploadToken,
        state: PendingUploadState.PLANNED,
      },
      { uploadLeaseExpiresAt: new Date(Date.now() + UPLOAD_LEASE_MS) },
    );
    if (result.affected !== 1)
      throw new ConflictException('Upload ownership lost');
  }

  private async claimDue(now: Date): Promise<CleanupClaim[]> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      const rows = await manager.query<PendingRow[]>(
        `
          SELECT
            "object_key",
            "upload_token",
            "state",
            "upload_lease_expires_at"
          FROM "pending_file_uploads"
          WHERE
            ("state" = 'planned' AND "upload_lease_expires_at" <= $1)
            OR ("state" = 'cleanup_pending' AND "next_attempt_at" <= $1)
            OR (
              "state" = 'deleting'
              AND "claim_lease_expires_at" <= $1
            )
          ORDER BY "created_at", "object_key"
          FOR UPDATE SKIP LOCKED
          LIMIT $2
        `,
        [now, RETRY_BATCH_SIZE],
      );
      const claims: CleanupClaim[] = [];
      for (const row of rows) {
        const claimToken = randomUUID();
        await manager.query(
          `
            UPDATE "pending_file_uploads"
            SET
              "state" = 'deleting',
              "claim_token" = $2,
              "claim_lease_expires_at" = $3,
              "attempt_count" = "attempt_count" + 1,
              "updated_at" = now()
            WHERE "object_key" = $1
          `,
          [row.object_key, claimToken, new Date(Date.now() + CLAIM_LEASE_MS)],
        );
        claims.push({ objectKey: row.object_key, claimToken });
      }
      return claims;
    });
  }

  private async reconcileClaim(
    claim: CleanupClaim,
  ): Promise<'deleted' | 'committed' | 'failed'> {
    const committed = await this.fileRepo.findOne({
      where: [
        { objectKey: claim.objectKey },
        { previewGlbObjectKey: claim.objectKey },
      ],
    });
    if (committed) {
      return (await this.clearClaim(claim)) ? 'committed' : 'failed';
    }
    await this.storageService.delete(claim.objectKey);
    return (await this.clearClaim(claim)) ? 'deleted' : 'failed';
  }

  private async clearClaim(claim: CleanupClaim): Promise<boolean> {
    const result = await this.pendingRepo.delete({
      objectKey: claim.objectKey,
      state: PendingUploadState.DELETING,
      claimToken: claim.claimToken,
    });
    return result.affected === 1;
  }

  private async releaseClaim(
    claim: CleanupClaim,
    error: unknown,
  ): Promise<void> {
    try {
      await this.pendingRepo.update(
        {
          objectKey: claim.objectKey,
          state: PendingUploadState.DELETING,
          claimToken: claim.claimToken,
        },
        {
          state: PendingUploadState.CLEANUP_PENDING,
          claimToken: null,
          claimLeaseExpiresAt: null,
          lastError: this.errorMessage(error).slice(0, 4000),
          nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
        },
      );
    } catch (updateError) {
      this.logger.error(
        `Could not release cleanup claim for ${claim.objectKey}; claim lease remains recoverable (${this.errorMessage(updateError)})`,
      );
    }
  }

  private async withClaimLeaseHeartbeat<T>(
    claim: CleanupClaim,
    operation: () => Promise<T>,
  ): Promise<T> {
    const heartbeat = setInterval(() => {
      void this.pendingRepo
        .update(
          {
            objectKey: claim.objectKey,
            state: PendingUploadState.DELETING,
            claimToken: claim.claimToken,
          },
          {
            claimLeaseExpiresAt: new Date(Date.now() + CLAIM_LEASE_MS),
          },
        )
        .catch((error: unknown) =>
          this.logger.error(
            `Could not renew cleanup claim for ${claim.objectKey} (${this.errorMessage(error)})`,
          ),
        );
    }, CLAIM_HEARTBEAT_MS);
    heartbeat.unref?.();
    try {
      return await operation();
    } finally {
      clearInterval(heartbeat);
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
