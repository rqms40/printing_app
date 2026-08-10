import { BadRequestException } from '@nestjs/common';

type RfqAuthorizationState = {
  id?: number;
  orderStatus?: string | null;
  pricingStatus?: string | null;
  quotedTotalMinor?: string | null;
  quotedAt?: Date | null;
};

export function isRfqQuoteOrder(order: RfqAuthorizationState): boolean {
  return (
    order.quotedTotalMinor != null ||
    order.quotedAt != null ||
    order.pricingStatus === 'pending_quote' ||
    order.pricingStatus === 'quoted'
  );
}

export function assertRfqAuthorizationReady(
  order: RfqAuthorizationState,
): void {
  if (
    isRfqQuoteOrder(order) &&
    (order.orderStatus !== 'awaiting_payment' ||
      order.pricingStatus !== 'accepted')
  ) {
    throw new BadRequestException({
      code: 'rfq_quote_not_accepted',
      message: 'RFQ payment requires customer acceptance of the current quote',
    });
  }
}
