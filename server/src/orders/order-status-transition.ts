import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from './entities/order.entity';

/** Actor that may request a controlled order status change. */
export type TransitionActor =
  | 'client'
  | 'supplier'
  | 'rider'
  | 'ops_admin'
  | 'super_admin'
  | 'system';

export type TransitionEdge = {
  to: OrderStatus;
  actors: readonly TransitionActor[];
};

const OPS: readonly TransitionActor[] = ['ops_admin', 'super_admin'];
/** Temporary dual-actor: ops can stand in for supplier until supplier APIs land. */
const SUPPLIER_OR_OPS: readonly TransitionActor[] = [
  'supplier',
  'ops_admin',
  'super_admin',
];
const SYSTEM_OR_OPS: readonly TransitionActor[] = [
  'system',
  'ops_admin',
  'super_admin',
];
const CLIENT_SYSTEM_OR_OPS: readonly TransitionActor[] = [
  'client',
  'system',
  'ops_admin',
  'super_admin',
];
const RIDER_OR_SYSTEM_OR_OPS: readonly TransitionActor[] = [
  'rider',
  'system',
  'ops_admin',
  'super_admin',
];
const CLIENT_OR_OPS: readonly TransitionActor[] = [
  'client',
  'ops_admin',
  'super_admin',
];

/**
 * Role-aware marketplace status graph.
 * Edges list *allowed* (to, actors). Terminal statuses have empty arrays.
 *
 * Dual-actor notes (documented in tests):
 * - ops_admin / super_admin may perform supplier production transitions
 *   (accept → production → self-QC → ready) until supplier portal flows land.
 * - system performs payment auth, matching assignment, issue-window open/close.
 */
export const ORDER_STATUS_TRANSITIONS: Record<
  OrderStatus,
  readonly TransitionEdge[]
> = {
  [OrderStatus.DRAFT]: [
    { to: OrderStatus.SUBMITTED, actors: ['client', 'system'] },
    { to: OrderStatus.CANCELLED, actors: CLIENT_OR_OPS },
  ],
  [OrderStatus.SUBMITTED]: [
    { to: OrderStatus.NEEDS_QA, actors: SYSTEM_OR_OPS },
    // QA is mandatory (Task 4.1+): no skip from submitted → approved_for_matching.
    { to: OrderStatus.FILE_REJECTED, actors: OPS },
    { to: OrderStatus.CANCELLED, actors: CLIENT_OR_OPS },
  ],
  [OrderStatus.NEEDS_QA]: [
    { to: OrderStatus.CLIENT_CORRECTION, actors: OPS },
    { to: OrderStatus.PROOF_APPROVAL, actors: OPS },
    { to: OrderStatus.APPROVED_FOR_MATCHING, actors: OPS },
    { to: OrderStatus.FILE_REJECTED, actors: OPS },
    { to: OrderStatus.CANCELLED, actors: OPS },
  ],
  [OrderStatus.CLIENT_CORRECTION]: [
    { to: OrderStatus.NEEDS_QA, actors: CLIENT_OR_OPS },
    { to: OrderStatus.CANCELLED, actors: CLIENT_OR_OPS },
  ],
  [OrderStatus.PROOF_APPROVAL]: [
    { to: OrderStatus.APPROVED_FOR_MATCHING, actors: CLIENT_OR_OPS },
    { to: OrderStatus.CLIENT_CORRECTION, actors: CLIENT_OR_OPS },
    { to: OrderStatus.NEEDS_QA, actors: OPS },
  ],
  [OrderStatus.APPROVED_FOR_MATCHING]: [
    { to: OrderStatus.SUPPLIER_ASSIGNED, actors: SYSTEM_OR_OPS },
    // Temp: ops may skip matching wiring until those modules land.
    // Money transitions must use authorizePayment — no status-only jump to
    // payment_authorized from matching.
    { to: OrderStatus.AWAITING_PAYMENT, actors: OPS },
    { to: OrderStatus.CANCELLED, actors: OPS },
  ],
  [OrderStatus.SUPPLIER_ASSIGNED]: [
    { to: OrderStatus.SUPPLIER_ACCEPTED, actors: SUPPLIER_OR_OPS },
    { to: OrderStatus.APPROVED_FOR_MATCHING, actors: SYSTEM_OR_OPS },
    { to: OrderStatus.CANCELLED, actors: OPS },
  ],
  [OrderStatus.SUPPLIER_ACCEPTED]: [
    { to: OrderStatus.AWAITING_PAYMENT, actors: CLIENT_SYSTEM_OR_OPS },
    // Money transition: ops/super authorize via POST /orders/:id/authorize-payment
    // only — not generic updateStatus (status-only path is hard-blocked).
    {
      to: OrderStatus.PAYMENT_AUTHORIZED,
      actors: SYSTEM_OR_OPS,
    },
    // 24h payment timeout: release capacity and re-enter matching.
    { to: OrderStatus.APPROVED_FOR_MATCHING, actors: ['system'] },
    { to: OrderStatus.CANCELLED, actors: OPS },
  ],
  [OrderStatus.AWAITING_PAYMENT]: [
    {
      to: OrderStatus.PAYMENT_AUTHORIZED,
      actors: SYSTEM_OR_OPS,
    },
    // 24h payment timeout: release capacity and re-enter matching.
    { to: OrderStatus.APPROVED_FOR_MATCHING, actors: ['system'] },
    { to: OrderStatus.CANCELLED, actors: CLIENT_OR_OPS },
  ],
  [OrderStatus.PAYMENT_AUTHORIZED]: [
    { to: OrderStatus.PRODUCTION, actors: SUPPLIER_OR_OPS },
    { to: OrderStatus.CANCELLED, actors: OPS },
  ],
  [OrderStatus.PRODUCTION]: [
    { to: OrderStatus.SUPPLIER_SELF_QC, actors: SUPPLIER_OR_OPS },
  ],
  [OrderStatus.SUPPLIER_SELF_QC]: [
    { to: OrderStatus.READY_FOR_DISPATCH, actors: SUPPLIER_OR_OPS },
    { to: OrderStatus.PRODUCTION, actors: SUPPLIER_OR_OPS },
  ],
  [OrderStatus.READY_FOR_DISPATCH]: [
    { to: OrderStatus.RIDER_ASSIGNED, actors: SYSTEM_OR_OPS },
    { to: OrderStatus.COLLECTED_BY_CUSTOMER, actors: OPS },
  ],
  [OrderStatus.RIDER_ASSIGNED]: [
    { to: OrderStatus.PICKED_UP, actors: RIDER_OR_SYSTEM_OR_OPS },
    { to: OrderStatus.READY_FOR_DISPATCH, actors: SYSTEM_OR_OPS },
  ],
  [OrderStatus.PICKED_UP]: [
    { to: OrderStatus.OUT_FOR_DELIVERY, actors: RIDER_OR_SYSTEM_OR_OPS },
    { to: OrderStatus.DELIVERY_FAILED, actors: RIDER_OR_SYSTEM_OR_OPS },
  ],
  [OrderStatus.OUT_FOR_DELIVERY]: [
    { to: OrderStatus.DELIVERED, actors: RIDER_OR_SYSTEM_OR_OPS },
    { to: OrderStatus.DELIVERY_FAILED, actors: RIDER_OR_SYSTEM_OR_OPS },
  ],
  [OrderStatus.DELIVERED]: [
    { to: OrderStatus.ISSUE_WINDOW_OPEN, actors: ['system'] },
    { to: OrderStatus.COMPLETED, actors: SYSTEM_OR_OPS },
  ],
  /** Ops stubs redelivery fee approval, then redispatch. */
  [OrderStatus.DELIVERY_FAILED]: [
    { to: OrderStatus.READY_FOR_DISPATCH, actors: OPS },
    { to: OrderStatus.CANCELLED, actors: OPS },
  ],
  [OrderStatus.COLLECTED_BY_CUSTOMER]: [
    { to: OrderStatus.ISSUE_WINDOW_OPEN, actors: ['system'] },
    { to: OrderStatus.COMPLETED, actors: SYSTEM_OR_OPS },
  ],
  [OrderStatus.ISSUE_WINDOW_OPEN]: [
    { to: OrderStatus.COMPLETED, actors: SYSTEM_OR_OPS },
  ],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.FILE_REJECTED]: [],
};

const TERMINAL_STATUSES = new Set<OrderStatus>([
  OrderStatus.COMPLETED,
  OrderStatus.CANCELLED,
  OrderStatus.FILE_REJECTED,
]);

function edgeActors(
  from: OrderStatus,
  to: OrderStatus,
): readonly TransitionActor[] | null {
  const edges = ORDER_STATUS_TRANSITIONS[from] ?? [];
  const edge = edges.find((e) => e.to === to);
  return edge?.actors ?? null;
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: TransitionActor,
): boolean {
  if (from === to) return true;
  const actors = edgeActors(from, to);
  return actors != null && actors.includes(actor);
}

export function allowedNextStatuses(
  from: OrderStatus,
  actor: TransitionActor,
): OrderStatus[] {
  return (ORDER_STATUS_TRANSITIONS[from] ?? [])
    .filter((e) => e.actors.includes(actor))
    .map((e) => e.to);
}

/**
 * Role-aware transition guard. Throws BadRequestException if illegal.
 */
export function assertTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: TransitionActor,
): void {
  if (from === to) return;
  if (isTerminalOrderStatus(from)) {
    throw new BadRequestException(
      from === OrderStatus.CANCELLED
        ? 'Cancelled orders are terminal'
        : `Orders in ${from} are terminal`,
    );
  }
  if (!canTransition(from, to, actor)) {
    const actors = edgeActors(from, to);
    if (actors == null) {
      throw new BadRequestException(`Cannot transition from ${from} to ${to}`);
    }
    throw new BadRequestException(
      `Actor ${actor} cannot transition from ${from} to ${to}`,
    );
  }
}

/**
 * Structure-only check (any actor may hold the edge). Used by existing
 * service paths that have not yet been wired to pass TransitionActor.
 * Prefer assertTransition(from, to, actor) for new code.
 */
export function assertOrderStatusTransition(
  fromStatus: OrderStatus,
  toStatus: OrderStatus,
): void {
  if (fromStatus === toStatus) return;
  if (isTerminalOrderStatus(fromStatus)) {
    throw new BadRequestException(
      fromStatus === OrderStatus.CANCELLED
        ? 'Cancelled orders are terminal'
        : `Orders in ${fromStatus} are terminal`,
    );
  }
  if (edgeActors(fromStatus, toStatus) == null) {
    throw new BadRequestException(
      `Cannot transition from ${fromStatus} to ${toStatus}`,
    );
  }
}

/**
 * Admin UI source statuses — ops production/QA path only.
 * Rider-owned and terminal states use dedicated workflows (not status dropdown).
 */
const ADMIN_OPERABLE_SOURCE_STATUSES = new Set<OrderStatus>([
  OrderStatus.DRAFT,
  OrderStatus.SUBMITTED,
  OrderStatus.NEEDS_QA,
  OrderStatus.CLIENT_CORRECTION,
  OrderStatus.PROOF_APPROVAL,
  OrderStatus.APPROVED_FOR_MATCHING,
  OrderStatus.SUPPLIER_ASSIGNED,
  OrderStatus.SUPPLIER_ACCEPTED,
  OrderStatus.AWAITING_PAYMENT,
  OrderStatus.PAYMENT_AUTHORIZED,
  OrderStatus.PRODUCTION,
  OrderStatus.SUPPLIER_SELF_QC,
  OrderStatus.READY_FOR_DISPATCH,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
]);

/**
 * Admin UI projection of next statuses for ops_admin.
 * Excludes cancellation (own workflow) and rider-owned delivery steps.
 * Rider reassignment (rider_assigned → ready_for_dispatch) stays on the rider
 * assignment API, not the generic status dropdown.
 */
export function adminAllowedNextOrderStatuses(
  fromStatus: OrderStatus,
  deliveryOption?: string | null,
): OrderStatus[] {
  if (!ADMIN_OPERABLE_SOURCE_STATUSES.has(fromStatus)) return [];

  if (
    fromStatus === OrderStatus.RIDER_ASSIGNED ||
    fromStatus === OrderStatus.PICKED_UP ||
    fromStatus === OrderStatus.OUT_FOR_DELIVERY
  ) {
    return [];
  }

  return allowedNextStatuses(fromStatus, 'ops_admin').filter(
    (toStatus) =>
      toStatus !== OrderStatus.CANCELLED &&
      // Money path: use POST /orders/:id/authorize-payment, not status dropdown.
      toStatus !== OrderStatus.PAYMENT_AUTHORIZED &&
      // Rider assignment has a dedicated Operations workflow.
      toStatus !== OrderStatus.RIDER_ASSIGNED &&
      (toStatus !== OrderStatus.COLLECTED_BY_CUSTOMER ||
        deliveryOption === 'pickup'),
  );
}

export function parseOrderStatus(status: string): OrderStatus {
  if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
    throw new BadRequestException(`Unknown order status: ${status}`);
  }
  return status as OrderStatus;
}

/** Legacy shop-queue → marketplace mapping used by migration + cutover adapters. */
export const LEGACY_ORDER_STATUS_MAP: Readonly<Record<string, OrderStatus>> = {
  order_placed: OrderStatus.SUBMITTED,
  file_verified: OrderStatus.APPROVED_FOR_MATCHING,
  file_declined: OrderStatus.FILE_REJECTED,
  printing_in_progress: OrderStatus.PRODUCTION,
  finishing_mounting: OrderStatus.PRODUCTION,
  quality_checked: OrderStatus.SUPPLIER_SELF_QC,
  ready_for_dispatch: OrderStatus.READY_FOR_DISPATCH,
  rider_assigned: OrderStatus.RIDER_ASSIGNED,
  picked_up: OrderStatus.PICKED_UP,
  on_the_way: OrderStatus.OUT_FOR_DELIVERY,
  arrived_at_destination: OrderStatus.OUT_FOR_DELIVERY,
  delivered: OrderStatus.DELIVERED,
  completed_pickup: OrderStatus.COLLECTED_BY_CUSTOMER,
  cancelled: OrderStatus.CANCELLED,
};
