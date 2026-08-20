import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { BatchOrder } from '../orders/entities/batch-order.entity';
import {
  OrdersGateway,
  type DeliveryQueueUpdatedPayload,
} from '../orders/orders.gateway';
import { DeliveryDestination } from '../orders/entities/delivery-destination.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from './entities/delivery-assignment.entity';
import {
  DispatchPlan,
  DispatchPlanStatus,
} from './entities/dispatch-plan.entity';
import {
  DispatchPlanStop,
  DispatchStopKind,
  DispatchStopStatus,
} from './entities/dispatch-plan-stop.entity';
import { RiderProfile } from './entities/rider-profile.entity';
import { ROUTING_PROVIDER } from './routing/routing-provider';
import type {
  GeoPoint,
  RouteLeg,
  RoutingProvider,
} from './routing/routing-provider';
import { solveOpenRoute } from './routing/small-route-solver';

const PLAN_ELIGIBLE_STATUSES = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.ACCEPTED,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.ON_THE_WAY,
  DeliveryStatus.ARRIVED,
];

const IN_TRANSIT_STATUSES = new Set<DeliveryStatus>([
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.ON_THE_WAY,
  DeliveryStatus.ARRIVED,
]);

type PlanningAssignment = {
  assignment: DeliveryAssignment;
  point: GeoPoint;
};

type PreparedPlan = {
  points: GeoPoint[];
  assignments: PlanningAssignment[];
  legs: RouteLeg[];
  totalDurationSeconds: number;
  totalDistanceMeters: number;
};

export type DispatchPlanProgress = {
  planId: number;
  riderId: number;
  planVersion: number;
  planStatus: DispatchPlanStatus.ACTIVE | DispatchPlanStatus.COMPLETED;
  assignmentId: number;
  stopStatus: DispatchStopStatus.COMPLETED | DispatchStopStatus.SKIPPED;
};

function routingUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'routing_unavailable',
    message: 'Road routing is temporarily unavailable',
  });
}

export function isDropoffStopKind(
  kind?: DispatchStopKind | string | null,
): boolean {
  return kind !== DispatchStopKind.PICKUP;
}

export function numericPoint(latitude: unknown, longitude: unknown): GeoPoint | null {
  if (
    latitude == null ||
    longitude == null ||
    (typeof latitude === 'string' && latitude.trim() === '') ||
    (typeof longitude === 'string' && longitude.trim() === '')
  ) {
    return null;
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

@Injectable()
export class DispatchPlanService {
  private readonly logger = new Logger(DispatchPlanService.name);
  private readonly origin: GeoPoint;
  private readonly routingProfile: string;

  constructor(
    @InjectRepository(DispatchPlan)
    private readonly planRepo: Repository<DispatchPlan>,
    @InjectRepository(DispatchPlanStop)
    private readonly stopRepo: Repository<DispatchPlanStop>,
    @InjectRepository(DeliveryAssignment)
    private readonly assignmentRepo: Repository<DeliveryAssignment>,
    @InjectRepository(RiderProfile)
    private readonly profileRepo: Repository<RiderProfile>,
    @Inject(ROUTING_PROVIDER)
    private readonly routingProvider: RoutingProvider,
    private readonly ordersGateway: OrdersGateway,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.routingProfile = config.get<string>('ROUTING_PROFILE', 'driving');
    const origin = numericPoint(
      config.get<string>('GRIDGO_STORE_LATITUDE', '7.064'),
      config.get<string>('GRIDGO_STORE_LONGITUDE', '125.6079'),
    );
    if (!origin) throw new Error('Invalid GRIDGO store coordinates');
    this.origin = origin;
  }

  async createPlan(
    riderId: number,
    assignmentIds: number[],
  ): Promise<DispatchPlan> {
    const planningAssignments = await this.loadPlanningAssignments(
      riderId,
      assignmentIds,
    );
    const prepared = await this.preparePlan(planningAssignments);
    return this.persistPreparedPlan(riderId, prepared, null);
  }

  async refreshMarketplaceOriginIfStale(
    _riderId: number,
    _gps: GeoPoint,
    _previousGps: GeoPoint | null,
    _previousAt: Date | null,
  ): Promise<DispatchPlan | null> {
    return null;
  }

  async reoptimizePlan(
    riderId: number,
    assignmentIds?: number[],
    expectedActivePlanId?: number,
  ): Promise<DispatchPlan> {
    const active = await this.getActivePlanForRider(riderId);
    if (!active) throw new NotFoundException('Active dispatch plan not found');
    if (expectedActivePlanId != null && active.id !== expectedActivePlanId) {
      throw new ConflictException(
        'Active dispatch plan changed; retry re-optimization',
      );
    }
    const requestedIds = assignmentIds?.length
      ? assignmentIds
      : (
          await this.assignmentRepo.find({
            where: {
              riderId,
              isCurrent: true,
              status: In(PLAN_ELIGIBLE_STATUSES),
            },
            order: { id: 'ASC' },
          })
        ).map((assignment) => assignment.id);
    const anchoredIds = (active.stops ?? [])
      .filter(
        (stop) =>
          stop.status === DispatchStopStatus.PENDING &&
          stop.assignment != null &&
          IN_TRANSIT_STATUSES.has(stop.assignment.status),
      )
      .sort((left, right) => left.sequence - right.sequence)
      .map((stop) => stop.assignmentId);
    const ids = [
      ...anchoredIds,
      ...requestedIds.filter((id) => !anchoredIds.includes(id)),
    ];
    const planningAssignments = await this.loadPlanningAssignments(
      riderId,
      ids,
    );
    let prepared: PreparedPlan;
    try {
      prepared = await this.preparePlan(planningAssignments, anchoredIds);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        let routingDataStale = active.routingDataStale;
        try {
          await this.planRepo.update(
            { id: active.id, status: DispatchPlanStatus.ACTIVE },
            { routingDataStale: true },
          );
          routingDataStale = true;
        } catch (staleMarkerError) {
          this.logger.warn(
            `Failed to mark dispatch plan ${active.id} routing stale after routing failure: ${staleMarkerError}`,
          );
        }
        const response = error.getResponse();
        const payload =
          typeof response === 'object' && response !== null
            ? (response as Record<string, unknown>)
            : { message: response };
        throw new ServiceUnavailableException({
          code: 'routing_unavailable',
          ...payload,
          preservedPlan: { ...active, routingDataStale },
        });
      }
      throw error;
    }
    return this.persistPreparedPlan(riderId, prepared, active.id);
  }

  async getActivePlanForRider(riderId: number): Promise<DispatchPlan | null> {
    const plan = await this.planRepo.findOne({
      where: { riderId, status: DispatchPlanStatus.ACTIVE },
      relations: [
        'stops',
        'stops.assignment',
        'stops.assignment.order',
        'stops.assignment.order.destination',
      ],
    });
    if (plan?.stops) {
      plan.stops.sort((left, right) => left.sequence - right.sequence);
    }
    return plan;
  }

  async getActivePlanForRiderUser(
    userId: number,
  ): Promise<DispatchPlan | null> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Rider profile not found');
    return this.getActivePlanForRider(profile.id);
  }

  async getCurrentPendingStopForRider(
    riderId: number,
  ): Promise<{ stop: DispatchPlanStop; planVersion: number } | null> {
    const plan = await this.getActivePlanForRider(riderId);
    const stop =
      plan?.stops
        ?.filter((stop) => stop.status === DispatchStopStatus.PENDING)
        .sort((left, right) => left.sequence - right.sequence)[0] ?? null;
    return plan && stop ? { stop, planVersion: plan.version } : null;
  }

  async assertCurrentStop(
    manager: EntityManager,
    riderId: number,
    assignmentId: number,
  ): Promise<void> {
    const plan = await manager.getRepository(DispatchPlan).findOne({
      where: { riderId, status: DispatchPlanStatus.ACTIVE },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) {
      return; // Gracefully allow if no dispatch plan exists (e.g. manual assignment)
    }
    const target = await manager.getRepository(DispatchPlanStop).findOne({
      where: { planId: plan.id, assignmentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!target) {
      return; // Gracefully allow if assignment is not in the plan
    }
    if (target.status !== DispatchStopStatus.PENDING) {
      throw new BadRequestException('Dispatch stop is already closed');
    }
    const current = await manager.getRepository(DispatchPlanStop).findOne({
      where: { planId: plan.id, status: DispatchStopStatus.PENDING },
      order: { sequence: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (current?.assignmentId !== assignmentId) {
      throw new BadRequestException(
        'Complete the current route stop before advancing this delivery',
      );
    }
  }

  async advanceStop(
    manager: EntityManager,
    riderId: number,
    assignmentId: number,
    outcome: DispatchStopStatus.COMPLETED | DispatchStopStatus.SKIPPED,
  ): Promise<DispatchPlanProgress | undefined> {
    const planRepo = manager.getRepository(DispatchPlan);
    const stopRepo = manager.getRepository(DispatchPlanStop);
    const plan = await planRepo.findOne({
      where: { riderId, status: DispatchPlanStatus.ACTIVE },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) {
      const latest = await planRepo.findOne({
        where: { riderId },
        order: { version: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (latest) {
        const closedStop = await stopRepo.findOne({
          where: { planId: latest.id, assignmentId },
          lock: { mode: 'pessimistic_write' },
        });
        // Idempotent retry after the plan already closed this stop.
        if (closedStop?.status === outcome) return;
      }
      // Manual / unplanned assignments may complete without a dispatch plan
      // (assertCurrentStop already allows this path).
      return;
    }
    const stop = await stopRepo.findOne({
      where: { planId: plan.id, assignmentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!stop) {
      // Assignment was never planned — allow completion like assertCurrentStop.
      return;
    }
    if (stop.status === outcome) return;
    if (stop.status !== DispatchStopStatus.PENDING) {
      throw new BadRequestException('Dispatch stop is already closed');
    }
    const current = await stopRepo.findOne({
      where: { planId: plan.id, status: DispatchStopStatus.PENDING },
      order: { sequence: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (current?.id !== stop.id) {
      throw new BadRequestException(
        'Complete the current route stop before advancing this delivery',
      );
    }

    const now = new Date();
    stop.status = outcome;
    if (outcome === DispatchStopStatus.COMPLETED) stop.completedAt = now;
    if (outcome === DispatchStopStatus.SKIPPED) stop.skippedAt = now;
    await stopRepo.save(stop);

    const next = await stopRepo.findOne({
      where: { planId: plan.id, status: DispatchStopStatus.PENDING },
      order: { sequence: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (!next) {
      plan.status = DispatchPlanStatus.COMPLETED;
      plan.completedAt = now;
      await planRepo.save(plan);
    }
    return {
      planId: plan.id,
      riderId: plan.riderId,
      planVersion: plan.version,
      planStatus:
        plan.status === DispatchPlanStatus.COMPLETED
          ? DispatchPlanStatus.COMPLETED
          : DispatchPlanStatus.ACTIVE,
      assignmentId,
      stopStatus: outcome,
    };
  }

  async skipStopIfPlanned(
    manager: EntityManager,
    riderId: number,
    assignmentId: number,
  ): Promise<DispatchPlanProgress | undefined> {
    const planRepo = manager.getRepository(DispatchPlan);
    const stopRepo = manager.getRepository(DispatchPlanStop);
    const plan = await planRepo.findOne({
      where: { riderId, status: DispatchPlanStatus.ACTIVE },
      lock: { mode: 'pessimistic_write' },
    });
    if (!plan) return;
    const stop = await stopRepo.findOne({
      where: { planId: plan.id, assignmentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!stop || stop.status === DispatchStopStatus.SKIPPED) return;
    if (stop.status !== DispatchStopStatus.PENDING) {
      throw new BadRequestException('Dispatch stop is already closed');
    }
    const current = await stopRepo.findOne({
      where: { planId: plan.id, status: DispatchStopStatus.PENDING },
      order: { sequence: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    if (current?.id !== stop.id) {
      throw new BadRequestException(
        'Complete the current route stop before advancing this delivery',
      );
    }
    const now = new Date();
    stop.status = DispatchStopStatus.SKIPPED;
    stop.skippedAt = now;
    await stopRepo.save(stop);
    const next = await stopRepo.findOne({
      where: { planId: plan.id, status: DispatchStopStatus.PENDING },
      order: { sequence: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    plan.routingDataStale = true;
    if (!next) {
      plan.status = DispatchPlanStatus.COMPLETED;
      plan.completedAt = now;
    }
    await planRepo.save(plan);
    return {
      planId: plan.id,
      riderId: plan.riderId,
      planVersion: plan.version,
      planStatus:
        plan.status === DispatchPlanStatus.COMPLETED
          ? DispatchPlanStatus.COMPLETED
          : DispatchPlanStatus.ACTIVE,
      assignmentId,
      stopStatus: DispatchStopStatus.SKIPPED,
    };
  }

  private async loadPlanningAssignments(
    riderId: number,
    assignmentIds: number[],
  ): Promise<PlanningAssignment[]> {
    const uniqueIds = [...new Set(assignmentIds)];
    if (
      !Number.isInteger(riderId) ||
      riderId <= 0 ||
      uniqueIds.length !== assignmentIds.length ||
      uniqueIds.length < 1 ||
      uniqueIds.length > 5 ||
      uniqueIds.some((id) => !Number.isInteger(id) || id <= 0)
    ) {
      throw new BadRequestException(
        'Select between one and five unique assignments',
      );
    }
    const profile = await this.profileRepo.findOne({ where: { id: riderId } });
    if (!profile) throw new NotFoundException('Rider profile not found');

    const assignments = await this.assignmentRepo.find({
      where: {
        id: In(uniqueIds),
        riderId,
        isCurrent: true,
        status: In(PLAN_ELIGIBLE_STATUSES),
      },
      relations: ['order', 'order.destination'],
      order: { id: 'ASC' },
    });
    if (assignments.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Every dispatch stop must be a current eligible assignment',
      );
    }
    return assignments.map((assignment) => {
      const point = numericPoint(
        assignment.order?.destination?.latitude,
        assignment.order?.destination?.longitude,
      );
      if (!point) {
        throw new BadRequestException(
          `Assignment ${assignment.id} has no routeable destination`,
        );
      }
      return { assignment, point };
    });
  }

  private async preparePlan(
    planningAssignments: PlanningAssignment[],
    anchoredAssignmentIds: number[] = [],
  ): Promise<PreparedPlan> {
    const assignmentById = new Map(
      planningAssignments.map((item) => [item.assignment.id, item]),
    );
    const anchoredAssignments = anchoredAssignmentIds.map((id) => {
      const item = assignmentById.get(id);
      if (!item) {
        throw new BadRequestException(
          'Every in-transit dispatch stop must remain in the route',
        );
      }
      return item;
    });
    const anchoredSet = new Set(anchoredAssignmentIds);
    const optimizableAssignments = planningAssignments.filter(
      ({ assignment }) => !anchoredSet.has(assignment.id),
    );
    try {
      let optimizedTail: PlanningAssignment[] = [];
      if (optimizableAssignments.length > 0) {
        const optimizationOrigin =
          anchoredAssignments.at(-1)?.point ?? this.origin;
        const matrixPoints = [
          optimizationOrigin,
          ...optimizableAssignments.map(({ point }) => point),
        ];
        const matrix = await this.routingProvider.getMatrix(matrixPoints);
        const solution = solveOpenRoute(matrix.durationsSeconds, [
          0,
          ...optimizableAssignments.map(({ assignment }) => assignment.id),
        ]);
        optimizedTail = solution.indices.slice(1).map((pointIndex) => {
          return optimizableAssignments[pointIndex - 1];
        });
      }
      const assignments = [...anchoredAssignments, ...optimizedTail];
      const orderedPoints = [
        this.origin,
        ...assignments.map(({ point }) => point),
      ];
      const legs = await this.routingProvider.getRoute(orderedPoints);
      if (legs.length !== assignments.length) throw routingUnavailable();
      return {
        points: orderedPoints,
        assignments,
        legs,
        totalDurationSeconds: Math.round(
          legs.reduce((total, leg) => total + leg.durationSeconds, 0),
        ),
        totalDistanceMeters: Math.round(
          legs.reduce((total, leg) => total + leg.distanceMeters, 0),
        ),
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw routingUnavailable();
    }
  }

  private async persistPreparedPlan(
    riderId: number,
    prepared: PreparedPlan,
    expectedActivePlanId: number | null,
  ): Promise<DispatchPlan> {
    const plan = await this.persistPreparedPlanTransaction(
      riderId,
      prepared,
      expectedActivePlanId,
    );
    this.publishQueuePositions(plan, prepared);
    return plan;
  }

  /**
   * Every persisted plan version changes queue positions for every stop's
   * customer, so each of them gets a deliveryQueueUpdated push — clients
   * refetch the affected order instead of waiting for a manual refresh.
   */
  private publishQueuePositions(
    plan: DispatchPlan,
    prepared: PreparedPlan,
  ): void {
    try {
      const assignmentById = new Map(
        prepared.assignments.map((item) => [item.assignment.id, item]),
      );
      const stops = [...(plan.stops ?? [])].sort(
        (left, right) => left.sequence - right.sequence,
      );
      stops.forEach((stop, index) => {
        const item = assignmentById.get(stop.assignmentId);
        const order = item?.assignment.order;
        if (!item || !order || order.userId == null) return;
        const canTrackDelivery =
          index === 0 &&
          [DeliveryStatus.ON_THE_WAY, DeliveryStatus.ARRIVED].includes(
            item.assignment.status,
          );
        const payload: DeliveryQueueUpdatedPayload = {
          orderId: order.id,
          orderRef: order.orderId,
          queuePosition: index + 1,
          queueSize: stops.length,
          canTrackDelivery,
          assignmentId: canTrackDelivery ? item.assignment.id : null,
          planVersion: plan.version,
        };
        this.ordersGateway.notifyDeliveryQueueUpdated(order.userId, payload);
      });
    } catch {
      // Realtime nudges must never fail plan persistence.
    }
  }

  private async persistPreparedPlanTransaction(
    riderId: number,
    prepared: PreparedPlan,
    expectedActivePlanId: number | null,
  ): Promise<DispatchPlan> {
    return this.dataSource.transaction(async (manager) => {
      const expectedById = new Map(
        prepared.assignments.map((item) => [item.assignment.id, item]),
      );
      const batchIds = [
        ...new Set(
          prepared.assignments
            .map(({ assignment }) => assignment.order?.batchOrderId)
            .filter((id): id is number => id != null),
        ),
      ].sort((left, right) => left - right);
      for (const batchId of batchIds) {
        await manager.getRepository(BatchOrder).findOneOrFail({
          where: { id: batchId },
          lock: { mode: 'pessimistic_write' },
        });
      }
      const orderIds = prepared.assignments
        .map(({ assignment }) => assignment.orderId)
        .sort((left, right) => left - right);
      const lockedOrders = new Map<number, Order>();
      for (const orderId of orderIds) {
        const lockedOrder = await manager.getRepository(Order).findOneOrFail({
          where: { id: orderId },
          lock: { mode: 'pessimistic_write' },
        });
        lockedOrders.set(orderId, lockedOrder);
      }
      const destinationIds = [
        ...new Set(
          [...lockedOrders.values()]
            .map((order) => order.destinationId)
            .filter((id): id is number => id != null),
        ),
      ].sort((left, right) => left - right);
      const lockedDestinations = new Map<number, DeliveryDestination>();
      for (const destinationId of destinationIds) {
        const destination = await manager
          .getRepository(DeliveryDestination)
          .findOneOrFail({
            where: { id: destinationId },
            lock: { mode: 'pessimistic_write' },
          });
        lockedDestinations.set(destinationId, destination);
      }

      const lockedAssignments: DeliveryAssignment[] = [];
      const assignmentIds = [...expectedById.keys()].sort(
        (left, right) => left - right,
      );
      for (const assignmentId of assignmentIds) {
        const locked = await manager.getRepository(DeliveryAssignment).findOne({
          where: {
            id: assignmentId,
            riderId,
            isCurrent: true,
            status: In(PLAN_ELIGIBLE_STATUSES),
          },
          lock: { mode: 'pessimistic_write' },
        });
        if (!locked) {
          throw new ConflictException(
            'Dispatch assignments changed while routing',
          );
        }
        lockedAssignments.push(locked);
      }
      for (const locked of lockedAssignments) {
        const expected = expectedById.get(locked.id)!;
        const lockedOrder = lockedOrders.get(locked.orderId);
        const lockedDestination =
          lockedOrder?.destinationId == null
            ? null
            : lockedDestinations.get(lockedOrder.destinationId);
        const lockedPoint = numericPoint(
          lockedDestination?.latitude,
          lockedDestination?.longitude,
        );
        if (
          !lockedPoint ||
          locked.orderId !== expected.assignment.orderId ||
          lockedOrder?.batchOrderId !==
            expected.assignment.order?.batchOrderId ||
          lockedOrder?.destinationId !==
            expected.assignment.order?.destinationId ||
          lockedPoint.latitude !== expected.point.latitude ||
          lockedPoint.longitude !== expected.point.longitude
        ) {
          throw new ConflictException(
            'Dispatch assignments changed while routing',
          );
        }
      }

      const profile = await manager.getRepository(RiderProfile).findOne({
        where: { id: riderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!profile) throw new NotFoundException('Rider profile not found');

      const planRepo = manager.getRepository(DispatchPlan);
      const active = await planRepo.findOne({
        where: { riderId, status: DispatchPlanStatus.ACTIVE },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        (expectedActivePlanId == null && active) ||
        (expectedActivePlanId != null && active?.id !== expectedActivePlanId)
      ) {
        throw new ConflictException(
          'Active dispatch plan changed while routing',
        );
      }
      const latest = await planRepo.findOne({
        where: { riderId },
        order: { version: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      const now = new Date();
      if (active) {
        active.status = DispatchPlanStatus.SUPERSEDED;
        active.supersededAt = now;
        await planRepo.save(active);
      }
      const plan = await planRepo.save(
        planRepo.create({
          riderId,
          version: (latest?.version ?? 0) + 1,
          status: DispatchPlanStatus.ACTIVE,
          originLatitude: this.origin.latitude,
          originLongitude: this.origin.longitude,
          provider: this.routingProvider.name,
          profile: this.routingProfile,
          totalDurationSeconds: prepared.totalDurationSeconds,
          totalDistanceMeters: prepared.totalDistanceMeters,
          routingDataStale: false,
          plannedAt: now,
          supersededAt: null,
          completedAt: null,
        }),
      );
      const stops = prepared.assignments.map((item, index) =>
        manager.getRepository(DispatchPlanStop).create({
          planId: plan.id,
          assignmentId: item.assignment.id,
          sequence: index + 1,
          status: DispatchStopStatus.PENDING,
          destinationLatitude: item.point.latitude,
          destinationLongitude: item.point.longitude,
          legDurationSeconds: Math.round(prepared.legs[index].durationSeconds),
          legDistanceMeters: Math.round(prepared.legs[index].distanceMeters),
          legGeometry: prepared.legs[index].geometry,
          completedAt: null,
          skippedAt: null,
        }),
      );
      plan.stops = await manager.getRepository(DispatchPlanStop).save(stops);
      return plan;
    });
  }
}
