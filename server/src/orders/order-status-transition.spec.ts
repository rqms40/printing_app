import { BadRequestException } from '@nestjs/common';
import {
  adminAllowedNextOrderStatuses,
  assertOrderStatusTransition,
  assertTransition,
  canTransition,
  isTerminalOrderStatus,
  LEGACY_ORDER_STATUS_MAP,
  ORDER_STATUS_TRANSITIONS,
  parseOrderStatus,
} from './order-status-transition';
import { OrderStatus } from './entities/order.entity';

describe('order status transitions (marketplace)', () => {
  it('declares an exhaustive transition policy for every order status', () => {
    expect(Object.keys(ORDER_STATUS_TRANSITIONS).sort()).toEqual(
      Object.values(OrderStatus).sort(),
    );
  });

  describe('happy-path graph', () => {
    it.each<[OrderStatus, OrderStatus, string]>([
      [OrderStatus.DRAFT, OrderStatus.SUBMITTED, 'client'],
      [OrderStatus.SUBMITTED, OrderStatus.NEEDS_QA, 'ops_admin'],
      [OrderStatus.NEEDS_QA, OrderStatus.CLIENT_CORRECTION, 'ops_admin'],
      [OrderStatus.CLIENT_CORRECTION, OrderStatus.NEEDS_QA, 'client'],
      [OrderStatus.NEEDS_QA, OrderStatus.PROOF_APPROVAL, 'ops_admin'],
      [OrderStatus.PROOF_APPROVAL, OrderStatus.APPROVED_FOR_MATCHING, 'client'],
      [OrderStatus.NEEDS_QA, OrderStatus.APPROVED_FOR_MATCHING, 'ops_admin'],
      [
        OrderStatus.APPROVED_FOR_MATCHING,
        OrderStatus.SUPPLIER_ASSIGNED,
        'system',
      ],
      [
        OrderStatus.SUPPLIER_ASSIGNED,
        OrderStatus.SUPPLIER_ACCEPTED,
        'supplier',
      ],
      [OrderStatus.SUPPLIER_ACCEPTED, OrderStatus.AWAITING_PAYMENT, 'system'],
      [OrderStatus.AWAITING_PAYMENT, OrderStatus.PAYMENT_AUTHORIZED, 'system'],
      [OrderStatus.PAYMENT_AUTHORIZED, OrderStatus.PRODUCTION, 'supplier'],
      [OrderStatus.PRODUCTION, OrderStatus.SUPPLIER_SELF_QC, 'supplier'],
      [
        OrderStatus.SUPPLIER_SELF_QC,
        OrderStatus.READY_FOR_DISPATCH,
        'supplier',
      ],
      [OrderStatus.READY_FOR_DISPATCH, OrderStatus.RIDER_ASSIGNED, 'ops_admin'],
      [OrderStatus.RIDER_ASSIGNED, OrderStatus.PICKED_UP, 'rider'],
      [OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY, 'rider'],
      [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, 'rider'],
      [OrderStatus.DELIVERED, OrderStatus.ISSUE_WINDOW_OPEN, 'system'],
      [OrderStatus.ISSUE_WINDOW_OPEN, OrderStatus.COMPLETED, 'system'],
      [
        OrderStatus.READY_FOR_DISPATCH,
        OrderStatus.COLLECTED_BY_CUSTOMER,
        'ops_admin',
      ],
      [
        OrderStatus.COLLECTED_BY_CUSTOMER,
        OrderStatus.ISSUE_WINDOW_OPEN,
        'system',
      ],
    ])('allows %s → %s for %s', (from, to, actor) => {
      expect(() => assertTransition(from, to, actor as never)).not.toThrow();
    });
  });

  describe('temporary dual-actor allowances (ops stand-in for supplier)', () => {
    it.each<[OrderStatus, OrderStatus]>([
      [OrderStatus.SUPPLIER_ASSIGNED, OrderStatus.SUPPLIER_ACCEPTED],
      [OrderStatus.PAYMENT_AUTHORIZED, OrderStatus.PRODUCTION],
      [OrderStatus.PRODUCTION, OrderStatus.SUPPLIER_SELF_QC],
      [OrderStatus.SUPPLIER_SELF_QC, OrderStatus.READY_FOR_DISPATCH],
    ])(
      'allows ops_admin and super_admin for production-like %s → %s',
      (from, to) => {
        expect(() => assertTransition(from, to, 'ops_admin')).not.toThrow();
        expect(() => assertTransition(from, to, 'super_admin')).not.toThrow();
      },
    );

    it('requires QA path: rejects submitted → approved_for_matching', () => {
      expect(
        canTransition(
          OrderStatus.SUBMITTED,
          OrderStatus.APPROVED_FOR_MATCHING,
          'ops_admin',
        ),
      ).toBe(false);
      expect(() =>
        assertTransition(
          OrderStatus.SUBMITTED,
          OrderStatus.APPROVED_FOR_MATCHING,
          'ops_admin',
        ),
      ).toThrow(/Cannot transition/);
    });

    it('payment_authorized is ops/system only (not client); use authorize-payment', () => {
      // No edge from matching → payment_authorized (must go through supplier accept).
      expect(
        canTransition(
          OrderStatus.APPROVED_FOR_MATCHING,
          OrderStatus.PAYMENT_AUTHORIZED,
          'ops_admin',
        ),
      ).toBe(false);
      // Graph allows ops/super/system for authorizePayment (status dropdown still excludes it).
      expect(
        canTransition(
          OrderStatus.AWAITING_PAYMENT,
          OrderStatus.PAYMENT_AUTHORIZED,
          'ops_admin',
        ),
      ).toBe(true);
      expect(
        canTransition(
          OrderStatus.SUPPLIER_ACCEPTED,
          OrderStatus.PAYMENT_AUTHORIZED,
          'super_admin',
        ),
      ).toBe(true);
      expect(
        canTransition(
          OrderStatus.AWAITING_PAYMENT,
          OrderStatus.PAYMENT_AUTHORIZED,
          'system',
        ),
      ).toBe(true);
      // Clients no longer authorize payment.
      expect(
        canTransition(
          OrderStatus.AWAITING_PAYMENT,
          OrderStatus.PAYMENT_AUTHORIZED,
          'client',
        ),
      ).toBe(false);
      expect(
        canTransition(
          OrderStatus.SUPPLIER_ACCEPTED,
          OrderStatus.PAYMENT_AUTHORIZED,
          'client',
        ),
      ).toBe(false);
    });
  });

  describe('illegal jumps and role violations', () => {
    it('rejects client jumping to production', () => {
      expect(() =>
        assertTransition(
          OrderStatus.SUBMITTED,
          OrderStatus.PRODUCTION,
          'client',
        ),
      ).toThrow(BadRequestException);
      expect(
        canTransition(OrderStatus.SUBMITTED, OrderStatus.PRODUCTION, 'client'),
      ).toBe(false);
    });

    it('rejects supplier skipping payment_authorized', () => {
      expect(() =>
        assertTransition(
          OrderStatus.SUPPLIER_ACCEPTED,
          OrderStatus.PRODUCTION,
          'supplier',
        ),
      ).toThrow(/Cannot transition|cannot transition/i);
      expect(
        canTransition(
          OrderStatus.SUPPLIER_ACCEPTED,
          OrderStatus.PRODUCTION,
          'supplier',
        ),
      ).toBe(false);
    });

    it('allows ops payment authorization from supplier_accepted / awaiting_payment', () => {
      expect(
        canTransition(
          OrderStatus.SUPPLIER_ACCEPTED,
          OrderStatus.PAYMENT_AUTHORIZED,
          'ops_admin',
        ),
      ).toBe(true);
      expect(
        canTransition(
          OrderStatus.AWAITING_PAYMENT,
          OrderStatus.PAYMENT_AUTHORIZED,
          'super_admin',
        ),
      ).toBe(true);
      expect(
        canTransition(
          OrderStatus.AWAITING_PAYMENT,
          OrderStatus.PAYMENT_AUTHORIZED,
          'client',
        ),
      ).toBe(false);
    });

    it('allows system payment-timeout rematch to approved_for_matching', () => {
      expect(
        canTransition(
          OrderStatus.SUPPLIER_ACCEPTED,
          OrderStatus.APPROVED_FOR_MATCHING,
          'system',
        ),
      ).toBe(true);
      expect(
        canTransition(
          OrderStatus.AWAITING_PAYMENT,
          OrderStatus.APPROVED_FOR_MATCHING,
          'system',
        ),
      ).toBe(true);
      expect(
        canTransition(
          OrderStatus.AWAITING_PAYMENT,
          OrderStatus.APPROVED_FOR_MATCHING,
          'client',
        ),
      ).toBe(false);
    });

    it('rejects supplier advancing before accept', () => {
      expect(() =>
        assertTransition(
          OrderStatus.SUPPLIER_ASSIGNED,
          OrderStatus.PRODUCTION,
          'supplier',
        ),
      ).toThrow();
    });

    it('rejects rider acting on pre-dispatch statuses', () => {
      expect(() =>
        assertTransition(
          OrderStatus.PRODUCTION,
          OrderStatus.READY_FOR_DISPATCH,
          'rider',
        ),
      ).toThrow();
    });

    it('rejects client approving matching without proof gate when not allowed', () => {
      expect(
        canTransition(
          OrderStatus.NEEDS_QA,
          OrderStatus.APPROVED_FOR_MATCHING,
          'client',
        ),
      ).toBe(false);
    });

    it.each<[OrderStatus, OrderStatus]>([
      [OrderStatus.SUBMITTED, OrderStatus.READY_FOR_DISPATCH],
      [OrderStatus.PRODUCTION, OrderStatus.SUBMITTED],
      [OrderStatus.PICKED_UP, OrderStatus.RIDER_ASSIGNED],
      [OrderStatus.DELIVERED, OrderStatus.OUT_FOR_DELIVERY],
    ])('rejects skipped or backward %s → %s (structure)', (from, to) => {
      expect(() => assertOrderStatusTransition(from, to)).toThrow(
        new BadRequestException(`Cannot transition from ${from} to ${to}`),
      );
    });

    it('rejects wrong actor even when edge exists', () => {
      expect(() =>
        assertTransition(
          OrderStatus.RIDER_ASSIGNED,
          OrderStatus.PICKED_UP,
          'client',
        ),
      ).toThrow(
        new BadRequestException(
          `Actor client cannot transition from ${OrderStatus.RIDER_ASSIGNED} to ${OrderStatus.PICKED_UP}`,
        ),
      );
    });
  });

  describe('terminals', () => {
    it.each([
      OrderStatus.FILE_REJECTED,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELLED,
    ])('treats %s as terminal', (fromStatus) => {
      expect(isTerminalOrderStatus(fromStatus)).toBe(true);
      expect(() =>
        assertTransition(fromStatus, OrderStatus.SUBMITTED, 'ops_admin'),
      ).toThrow();
      expect(() =>
        assertOrderStatusTransition(fromStatus, OrderStatus.SUBMITTED),
      ).toThrow();
    });
  });

  it('allows an idempotent status check without creating a transition', () => {
    expect(() =>
      assertTransition(
        OrderStatus.READY_FOR_DISPATCH,
        OrderStatus.READY_FOR_DISPATCH,
        'ops_admin',
      ),
    ).not.toThrow();
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

  it('parses every marketplace status value', () => {
    for (const status of Object.values(OrderStatus)) {
      expect(parseOrderStatus(status)).toBe(status);
    }
  });

  describe('adminAllowedNextOrderStatuses', () => {
    it('projects ops-operable QA transitions from submitted (no matching skip)', () => {
      expect(
        adminAllowedNextOrderStatuses(OrderStatus.SUBMITTED, 'delivery'),
      ).toEqual(
        expect.arrayContaining([
          OrderStatus.NEEDS_QA,
          OrderStatus.FILE_REJECTED,
        ]),
      );
      expect(
        adminAllowedNextOrderStatuses(OrderStatus.SUBMITTED, 'delivery'),
      ).not.toContain(OrderStatus.APPROVED_FOR_MATCHING);
      expect(
        adminAllowedNextOrderStatuses(OrderStatus.SUBMITTED, 'delivery'),
      ).not.toContain(OrderStatus.CANCELLED);
    });

    it('allows pickup completion only for pickup orders', () => {
      expect(
        adminAllowedNextOrderStatuses(OrderStatus.READY_FOR_DISPATCH, 'pickup'),
      ).toContain(OrderStatus.COLLECTED_BY_CUSTOMER);
      expect(
        adminAllowedNextOrderStatuses(
          OrderStatus.READY_FOR_DISPATCH,
          'delivery',
        ),
      ).not.toContain(OrderStatus.COLLECTED_BY_CUSTOMER);
    });

    it('never exposes rider-owned delivery transitions to admin UI', () => {
      expect(
        adminAllowedNextOrderStatuses(OrderStatus.RIDER_ASSIGNED, 'delivery'),
      ).toEqual([]);
      expect(
        adminAllowedNextOrderStatuses(OrderStatus.PICKED_UP, 'delivery'),
      ).toEqual([]);
      expect(
        adminAllowedNextOrderStatuses(OrderStatus.OUT_FOR_DELIVERY, 'delivery'),
      ).toEqual([]);
    });

    it('allows ops to advance production path (temp dual-actor)', () => {
      expect(
        adminAllowedNextOrderStatuses(
          OrderStatus.PAYMENT_AUTHORIZED,
          'delivery',
        ),
      ).toEqual([OrderStatus.PRODUCTION]);
      expect(
        adminAllowedNextOrderStatuses(OrderStatus.PRODUCTION, 'delivery'),
      ).toEqual([OrderStatus.SUPPLIER_SELF_QC]);
      expect(
        adminAllowedNextOrderStatuses(OrderStatus.SUPPLIER_SELF_QC, 'delivery'),
      ).toContain(OrderStatus.READY_FOR_DISPATCH);
    });
  });

  describe('legacy mapping', () => {
    it('maps every known legacy label', () => {
      expect(LEGACY_ORDER_STATUS_MAP.order_placed).toBe(OrderStatus.SUBMITTED);
      expect(LEGACY_ORDER_STATUS_MAP.file_verified).toBe(
        OrderStatus.APPROVED_FOR_MATCHING,
      );
      expect(LEGACY_ORDER_STATUS_MAP.file_declined).toBe(
        OrderStatus.FILE_REJECTED,
      );
      expect(LEGACY_ORDER_STATUS_MAP.printing_in_progress).toBe(
        OrderStatus.PRODUCTION,
      );
      expect(LEGACY_ORDER_STATUS_MAP.finishing_mounting).toBe(
        OrderStatus.PRODUCTION,
      );
      expect(LEGACY_ORDER_STATUS_MAP.quality_checked).toBe(
        OrderStatus.SUPPLIER_SELF_QC,
      );
      expect(LEGACY_ORDER_STATUS_MAP.on_the_way).toBe(
        OrderStatus.OUT_FOR_DELIVERY,
      );
      expect(LEGACY_ORDER_STATUS_MAP.arrived_at_destination).toBe(
        OrderStatus.OUT_FOR_DELIVERY,
      );
      expect(LEGACY_ORDER_STATUS_MAP.completed_pickup).toBe(
        OrderStatus.COLLECTED_BY_CUSTOMER,
      );
    });
  });
});
