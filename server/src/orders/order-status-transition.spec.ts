import { BadRequestException } from '@nestjs/common';
import {
  adminAllowedNextOrderStatuses,
  assertOrderStatusTransition,
  ORDER_STATUS_TRANSITIONS,
  parseOrderStatus,
} from './order-status-transition';
import { OrderStatus } from './entities/order.entity';

describe('order status transitions', () => {
  it('declares an exhaustive transition policy for every order status', () => {
    expect(Object.keys(ORDER_STATUS_TRANSITIONS).sort()).toEqual(
      Object.values(OrderStatus).sort(),
    );
  });

  it.each<[OrderStatus, OrderStatus]>([
    [OrderStatus.ORDER_PLACED, OrderStatus.FILE_VERIFIED],
    [OrderStatus.ORDER_PLACED, OrderStatus.FILE_DECLINED],
    [OrderStatus.ORDER_PLACED, OrderStatus.CANCELLED],
    [OrderStatus.FILE_VERIFIED, OrderStatus.PRINTING_IN_PROGRESS],
    [OrderStatus.FILE_VERIFIED, OrderStatus.CANCELLED],
    [OrderStatus.PRINTING_IN_PROGRESS, OrderStatus.FINISHING_MOUNTING],
    [OrderStatus.FINISHING_MOUNTING, OrderStatus.QUALITY_CHECKED],
    [OrderStatus.QUALITY_CHECKED, OrderStatus.READY_FOR_DISPATCH],
    [OrderStatus.READY_FOR_DISPATCH, OrderStatus.RIDER_ASSIGNED],
    [OrderStatus.READY_FOR_DISPATCH, OrderStatus.COMPLETED_PICKUP],
    [OrderStatus.RIDER_ASSIGNED, OrderStatus.READY_FOR_DISPATCH],
    [OrderStatus.RIDER_ASSIGNED, OrderStatus.PICKED_UP],
    [OrderStatus.PICKED_UP, OrderStatus.ON_THE_WAY],
    [OrderStatus.ON_THE_WAY, OrderStatus.ARRIVED_AT_DESTINATION],
    [OrderStatus.ARRIVED_AT_DESTINATION, OrderStatus.DELIVERED],
  ])('allows the legitimate %s to %s path', (fromStatus, toStatus) => {
    expect(() =>
      assertOrderStatusTransition(fromStatus, toStatus),
    ).not.toThrow();
  });

  it.each<[OrderStatus, OrderStatus]>([
    [OrderStatus.ORDER_PLACED, OrderStatus.READY_FOR_DISPATCH],
    [OrderStatus.PRINTING_IN_PROGRESS, OrderStatus.ORDER_PLACED],
    [OrderStatus.PICKED_UP, OrderStatus.RIDER_ASSIGNED],
  ])(
    'rejects the skipped or backward %s to %s path',
    (fromStatus, toStatus) => {
      expect(() => assertOrderStatusTransition(fromStatus, toStatus)).toThrow(
        new BadRequestException(
          `Cannot transition from ${fromStatus} to ${toStatus}`,
        ),
      );
    },
  );

  it.each([
    OrderStatus.FILE_DECLINED,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED_PICKUP,
    OrderStatus.CANCELLED,
  ])('treats %s as terminal', (fromStatus) => {
    expect(() =>
      assertOrderStatusTransition(fromStatus, OrderStatus.ORDER_PLACED),
    ).toThrow();
  });

  it('allows an idempotent status check without creating a transition', () => {
    expect(() =>
      assertOrderStatusTransition(
        OrderStatus.READY_FOR_DISPATCH,
        OrderStatus.READY_FOR_DISPATCH,
      ),
    ).not.toThrow();
  });

  it('rejects an unknown status string', () => {
    expect(() => parseOrderStatus('ready-ish')).toThrow(
      'Unknown order status: ready-ish',
    );
  });

  it.each([
    [OrderStatus.ORDER_PLACED, 'delivery', [OrderStatus.FILE_VERIFIED, OrderStatus.FILE_DECLINED]],
    [OrderStatus.FILE_VERIFIED, 'delivery', [OrderStatus.PRINTING_IN_PROGRESS]],
    [OrderStatus.FILE_DECLINED, 'delivery', []],
    [OrderStatus.PRINTING_IN_PROGRESS, 'delivery', [OrderStatus.FINISHING_MOUNTING]],
    [OrderStatus.FINISHING_MOUNTING, 'delivery', [OrderStatus.QUALITY_CHECKED]],
    [OrderStatus.QUALITY_CHECKED, 'delivery', [OrderStatus.READY_FOR_DISPATCH]],
    [OrderStatus.READY_FOR_DISPATCH, 'delivery', []],
    [OrderStatus.READY_FOR_DISPATCH, 'pickup', [OrderStatus.COMPLETED_PICKUP]],
    [OrderStatus.RIDER_ASSIGNED, 'delivery', []],
    [OrderStatus.PICKED_UP, 'delivery', []],
    [OrderStatus.ON_THE_WAY, 'delivery', []],
    [OrderStatus.ARRIVED_AT_DESTINATION, 'delivery', []],
    [OrderStatus.DELIVERED, 'delivery', []],
    [OrderStatus.COMPLETED_PICKUP, 'pickup', []],
    [OrderStatus.CANCELLED, 'delivery', []],
  ] as const)(
    'projects exact admin-operable transitions from %s for %s orders',
    (fromStatus, deliveryOption, expected) => {
      expect(
        adminAllowedNextOrderStatuses(fromStatus, deliveryOption),
      ).toEqual(expected);
    },
  );
});
