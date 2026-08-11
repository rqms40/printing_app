import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FilesService } from './files.service';
import { PendingUploadCleanupService } from './pending-upload-cleanup.service';

@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(
    private readonly filesService: FilesService,
    private readonly pendingUploadCleanup: PendingUploadCleanupService,
  ) {}

  @Cron('*/15 * * * *')
  async runPendingUploadCleanupSweep(): Promise<void> {
    const result = await this.pendingUploadCleanup.retryDue();
    this.logger.log(
      `Pending upload cleanup: ${result.deleted} deleted, ${result.committed} committed, ${result.failed} failed of ${result.found} found`,
    );
  }

  @Cron('0 2 * * *')
  async runPurgeSweep(): Promise<void> {
    this.logger.log('Starting nightly file purge sweep');
    const result = await this.filesService.deleteExpired();
    this.logger.log(
      `Purge sweep complete: ${result.deleted} deleted, ${result.failed} failed, ${result.skipped} skipped of ${result.found} found`,
    );
  }
}
