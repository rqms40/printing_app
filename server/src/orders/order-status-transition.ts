import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from './entities/order.entity';

export const ORDER_STATUS_TRANSITIONS: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  [OrderStatus.ORDER_PLACED]: [
    OrderStatus.FILE_VERIFIED,
    OrderStatus.FILE_DECLINED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.FILE_VERIFIED]: [
    OrderStatus.PRINTING_IN_PROGRESS,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.FILE_DECLINED]: [],
  [OrderStatus.PRINTING_IN_PROGRESS]: [OrderStatus.FINISHING_MOUNTING],
  [OrderStatus.FINISHING_MOUNTING]: [OrderStatus.QUALITY_CHECKED],
  [OrderStatus.QUALITY_CHECKED]: [OrderStatus.READY_FOR_DISPATCH],
  [OrderStatus.READY_FOR_DISPATCH]: [
    OrderStatus.RIDER_ASSIGNED,
    OrderStatus.COMPLETED_PICKUP,
  ],
  [OrderStatus.RIDER_ASSIGNED]: [
    OrderStatus.PICKED_UP,
    OrderStatus.READY_FOR_DISPATCH,
  ],
  [OrderStatus.PICKED_UP]: [OrderStatus.ON_THE_WAY],
  [OrderStatus.ON_THE_WAY]: [OrderStatus.ARRIVED_AT_DESTINATION],
  [OrderStatus.ARRIVED_AT_DESTINATION]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.COMPLETED_PICKUP]: [],
  [OrderStatus.CANCELLED]: [],
};

const ADMIN_OPERABLE_SOURCE_STATUSES = new Set<OrderStatus>([
  OrderStatus.ORDER_PLACED,
  OrderStatus.FILE_VERIFIED,
  OrderStatus.PRINTING_IN_PROGRESS,
  OrderStatus.FINISHING_MOUNTING,
  OrderStatus.QUALITY_CHECKED,
  OrderStatus.READY_FOR_DISPATCH,
]);

const ADMIN_OPERABLE_TARGET_STATUSES = new Set<OrderStatus>([
  OrderStatus.FILE_VERIFIED,
  OrderStatus.FILE_DECLINED,
  OrderStatus.PRINTING_IN_PROGRESS,
  OrderStatus.FINISHING_MOUNTING,
  OrderStatus.QUALITY_CHECKED,
  OrderStatus.READY_FOR_DISPATCH,
  OrderStatus.COMPLETED_PICKUP,
]);

export function adminAllowedNextOrderStatuses(
  fromStatus: OrderStatus,
  deliveryOption?: string | null,
): OrderStatus[] {
  if (!ADMIN_OPERABLE_SOURCE_STATUSES.has(fromStatus)) return [];

  return ORDER_STATUS_TRANSITIONS[fromStatus].filter(
    (toStatus) =>
      ADMIN_OPERABLE_TARGET_STATUSES.has(toStatus) &&
      (toStatus !== OrderStatus.COMPLETED_PICKUP ||
        deliveryOption === 'pickup'),
  );
}

export function parseOrderStatus(status: string): OrderStatus {
  if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
    throw new BadRequestException(`Unknown order status: ${status}`);
  }
  return status as OrderStatus;
}

export function assertOrderStatusTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): void {
  if (fromStatus === toStatus) return;
  if (fromStatus === OrderStatus.CANCELLED) {
    throw new BadRequestException('Cancelled orders are terminal');
  }
  if (!ORDER_STATUS_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new BadRequestException(
      `Cannot transition from ${fromStatus} to ${toStatus}`,
    );
  }
}
