import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { StorageService } from '../storage/storage.service';
import { FileMetadata } from './entities/file-metadata.entity';
import {
  PendingFileUpload,
  PendingUploadState,
} from './entities/pending-file-upload.entity';

const PLANNED_GRACE_MS = 15 * 60 * 1000;
const RETRY_DELAY_MS = 15 * 60 * 1000;
const RETRY_BATCH_SIZE = 100;

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
  ) {}

  async plan(objectKey: string): Promise<void> {
    const job = this.pendingRepo.create({
      objectKey,
      state: PendingUploadState.PLANNED,
      attemptCount: 0,
      lastError: null,
      nextAttemptAt: new Date(Date.now() + PLANNED_GRACE_MS),
    });
    await this.pendingRepo.save(job);
  }

  async complete(objectKeys: string[]): Promise<void> {
    for (const objectKey of objectKeys) {
      try {
        await this.pendingRepo.delete(objectKey);
      } catch (error) {
        this.logger.error(
          `Could not clear committed pending-upload job ${objectKey} (${this.errorMessage(error)})`,
        );
      }
    }
  }

  async queueCleanupAndReconcile(
    objectKeys: string[],
    cause: unknown,
  ): Promise<void> {
    for (const objectKey of [...objectKeys].reverse()) {
      await this.markCleanupPending(objectKey, cause, false);
      await this.reconcile(objectKey);
    }
  }

  async retryDue(now = new Date()): Promise<PendingUploadRetryResult> {
    const jobs = await this.pendingRepo.find({
      where: { nextAttemptAt: LessThanOrEqual(now) },
      order: { createdAt: 'ASC' },
      take: RETRY_BATCH_SIZE,
    });
    const result: PendingUploadRetryResult = {
      found: jobs.length,
      deleted: 0,
      committed: 0,
      failed: 0,
    };
    for (const job of jobs) {
      const outcome = await this.reconcile(job.objectKey);
      result[outcome] += 1;
    }
    return result;
  }

  private async reconcile(
    objectKey: string,
  ): Promise<'deleted' | 'committed' | 'failed'> {
    try {
      const committed = await this.fileRepo.findOne({
        where: [{ objectKey }, { previewGlbObjectKey: objectKey }],
      });
      if (committed) {
        await this.pendingRepo.delete(objectKey);
        return 'committed';
      }
    } catch (error) {
      await this.markCleanupPending(objectKey, error, true);
      return 'failed';
    }

    try {
      await this.storageService.delete(objectKey);
      await this.pendingRepo.delete(objectKey);
      return 'deleted';
    } catch (error) {
      await this.markCleanupPending(objectKey, error, true);
      return 'failed';
    }
  }

  private async markCleanupPending(
    objectKey: string,
    error: unknown,
    incrementAttempt: boolean,
  ): Promise<void> {
    try {
      await this.pendingRepo.update(
        { objectKey },
        {
          state: PendingUploadState.CLEANUP_PENDING,
          ...(incrementAttempt
            ? { attemptCount: () => '"attempt_count" + 1' }
            : {}),
          lastError: this.errorMessage(error).slice(0, 4000),
          nextAttemptAt: new Date(Date.now() + RETRY_DELAY_MS),
        },
      );
    } catch (updateError) {
      this.logger.error(
        `Could not update pending-upload cleanup job ${objectKey}; the durable planned row remains (${this.errorMessage(updateError)})`,
      );
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
