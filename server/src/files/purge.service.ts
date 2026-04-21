import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FilesService } from './files.service';

@Injectable()
export class PurgeService {
  private readonly logger = new Logger(PurgeService.name);

  constructor(private readonly filesService: FilesService) {}

  @Cron('0 2 * * *')
  async runPurgeSweep(): Promise<void> {
    this.logger.log('Starting nightly file purge sweep');
    const result = await this.filesService.deleteExpired();
    this.logger.log(
      `Purge sweep complete: ${result.deleted} deleted, ${result.skipped} skipped of ${result.found} found`,
    );
  }
}
