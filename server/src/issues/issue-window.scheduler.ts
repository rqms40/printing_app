import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IssuesService } from './issues.service';

/**
 * Issue window close job (PRD §6.3): 24h after delivery proof.
 * Closes window when no open claims remain; releases issue_window payout hold.
 */
@Injectable()
export class IssueWindowScheduler {
  private readonly logger = new Logger(IssueWindowScheduler.name);

  constructor(private readonly issuesService: IssuesService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleIssueWindowCron(): Promise<void> {
    this.logger.log('Scanning for expired material issue windows…');
    try {
      const result = await this.issuesService.closeExpiredIssueWindows();
      this.logger.log(
        `Issue window scan complete: closed=${result.closed} scanned=${result.scanned}`,
      );
    } catch (err) {
      this.logger.error(`Issue window scan failed: ${err}`);
    }
  }
}
