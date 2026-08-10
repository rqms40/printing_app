import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrdersService } from './orders.service';

/**
 * Client payment window after supplier accept (PRD §6.3): 24 hours.
 * On expiry → release assignment (stub) and re-enter matching.
 */
@Injectable()
export class PaymentTimeoutScheduler {
  private readonly logger = new Logger(PaymentTimeoutScheduler.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handlePaymentTimeoutCron(): Promise<void> {
    this.logger.log('Scanning for expired payment-authorization waits…');
    try {
      const result =
        await this.ordersService.expireStalePaymentAuthorizations();
      this.logger.log(
        `Payment timeout scan complete: expired=${result.expiredOrderIds.length} scanned=${result.scanned}`,
      );
    } catch (err) {
      this.logger.error(`Payment timeout scan failed: ${err}`);
    }
  }
}
