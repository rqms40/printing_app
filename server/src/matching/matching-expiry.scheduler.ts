import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MatchingService } from './matching.service';

/**
 * Supplier acceptance SLA (PRD §6.3): default 24h after assignment.
 * On expiry → release soft capacity and re-enter approved_for_matching.
 */
@Injectable()
export class MatchingExpiryScheduler {
  private readonly logger = new Logger(MatchingExpiryScheduler.name);

  constructor(private readonly matchingService: MatchingService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleMatchingExpiryCron(): Promise<void> {
    this.logger.log('Scanning for expired supplier acceptance SLAs…');
    try {
      const result = await this.matchingService.expireStaleAssignments();
      this.logger.log(
        `Matching expiry scan complete: expired=${result.expiredAssignmentIds.length} scanned=${result.scanned}`,
      );
    } catch (err) {
      this.logger.error(`Matching expiry scan failed: ${err}`);
    }
  }
}
