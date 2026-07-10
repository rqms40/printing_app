import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { BatchOrder } from '../orders/entities/batch-order.entity';
import { DeliveryDestination } from '../orders/entities/delivery-destination.entity';
import { DispatchPlanService } from './dispatch-plan.service';
import {
  DispatchPlan,
  DispatchPlanStatus,
} from './entities/dispatch-plan.entity';
import {
  DispatchPlanStop,
  DispatchStopStatus,
} from './entities/dispatch-plan-stop.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from './entities/delivery-assignment.entity';
import { RiderProfile } from './entities/rider-profile.entity';
import { RoutingProvider } from './routing/routing-provider';

describe('DispatchPlanService', () => {
  const rider = { id: 7, userId: 70 } as RiderProfile;
  const mark = {
    id: 11,
    riderId: rider.id,
    orderId: 101,
    isCurrent: true,
    status: DeliveryStatus.ASSIGNED,
    order: {
      id: 101,
      batchOrderId: null,
      destinationId: 201,
      destination: { id: 201, latitude: 7.074, longitude: 125.6079 },
    },
  } as DeliveryAssignment;
  const ven = {
    id: 12,
    riderId: rider.id,
    orderId: 102,
    isCurrent: true,
    status: DeliveryStatus.ASSIGNED,
    order: {
      id: 102,
      batchOrderId: null,
      destinationId: 202,
      destination: { id: 202, latitude: 7.0645, longitude: 125.6079 },
    },
  } as DeliveryAssignment;

  let planRepo: jest.Mocked<Partial<Repository<DispatchPlan>>>;
  let stopRepo: jest.Mocked<Partial<Repository<DispatchPlanStop>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let profileRepo: jest.Mocked<Partial<Repository<RiderProfile>>>;
  let orderRepo: jest.Mocked<Partial<Repository<Order>>>;
  let batchRepo: jest.Mocked<Partial<Repository<BatchOrder>>>;
  let destinationRepo: jest.Mocked<Partial<Repository<DeliveryDestination>>>;
  let provider: jest.Mocked<RoutingProvider>;
  let manager: jest.Mocked<Partial<EntityManager>>;
  let dataSource: jest.Mocked<Partial<DataSource>>;
  let service: DispatchPlanService;

  beforeEach(() => {
    planRepo = {
      findOne: jest.fn(),
      create: jest.fn((value) => value as DispatchPlan),
      save: jest.fn(
        async (value) =>
          ({ ...value, id: (value as DispatchPlan).id ?? 501 }) as DispatchPlan,
      ),
      update: jest.fn(),
    };
    stopRepo = {
      create: jest.fn((value) => value as DispatchPlanStop),
      save: jest.fn(async (value) => value as DispatchPlanStop[]),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    assignmentRepo = {
      find: jest.fn(),
      findOne: jest.fn(async (options) => {
        const id = (options?.where as { id?: number })?.id;
        return [mark, ven].find((assignment) => assignment.id === id) ?? null;
      }),
    };
    profileRepo = { findOne: jest.fn() };
    orderRepo = {
      find: jest.fn(),
      findOneOrFail: jest.fn(async (options) => {
        const id = (options?.where as { id?: number })?.id;
        return [mark.order, ven.order].find(
          (order) => order.id === id,
        ) as Order;
      }),
    };
    batchRepo = { findOneOrFail: jest.fn() };
    destinationRepo = {
      findOneOrFail: jest.fn(async (options) => {
        const id = (options?.where as { id?: number })?.id;
        return [mark.order.destination, ven.order.destination].find(
          (destination) => destination.id === id,
        ) as DeliveryDestination;
      }),
    };
    provider = {
      name: 'osrm',
      getMatrix: jest.fn().mockResolvedValue({
        durationsSeconds: [
          [0, 900, 240],
          [900, 0, 500],
          [240, 500, 0],
        ],
        distancesMeters: [
          [0, 9000, 2000],
          [9000, 0, 4000],
          [2000, 4000, 0],
        ],
      }),
      getRoute: jest.fn().mockResolvedValue([
        {
          fromIndex: 0,
          toIndex: 1,
          durationSeconds: 240,
          distanceMeters: 2000,
          geometry: {
            type: 'LineString',
            coordinates: [
              [125.6079, 7.064],
              [125.6079, 7.0645],
            ],
          },
        },
        {
          fromIndex: 1,
          toIndex: 2,
          durationSeconds: 500,
          distanceMeters: 4000,
          geometry: {
            type: 'LineString',
            coordinates: [
              [125.6079, 7.0645],
              [125.6079, 7.074],
            ],
          },
        },
      ]),
    };
    profileRepo.findOne!.mockResolvedValue(rider);
    assignmentRepo.find!.mockResolvedValue([mark, ven]);
    orderRepo.find!.mockResolvedValue([mark.order, ven.order] as Order[]);
    planRepo.findOne!.mockResolvedValue(null);
    manager = {
      getRepository: jest.fn((entity) => {
        if (entity === RiderProfile)
          return profileRepo as Repository<RiderProfile>;
        if (entity === DeliveryAssignment)
          return assignmentRepo as Repository<DeliveryAssignment>;
        if (entity === Order) return orderRepo as Repository<Order>;
        if (entity === BatchOrder) return batchRepo as Repository<BatchOrder>;
        if (entity === DeliveryDestination)
          return destinationRepo as Repository<DeliveryDestination>;
        if (entity === DispatchPlan)
          return planRepo as Repository<DispatchPlan>;
        if (entity === DispatchPlanStop)
          return stopRepo as Repository<DispatchPlanStop>;
        const entityName =
          typeof entity === 'function' ? entity.name : 'unknown entity';
        throw new Error(`Unexpected repository ${entityName}`);
      }),
    };
    dataSource = {
      transaction: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => await callback(manager as EntityManager),
      ),
    };
    service = new DispatchPlanService(
      planRepo as Repository<DispatchPlan>,
      stopRepo as Repository<DispatchPlanStop>,
      assignmentRepo as Repository<DeliveryAssignment>,
      profileRepo as Repository<RiderProfile>,
      provider,
      dataSource as DataSource,
      new ConfigService({
        ROUTING_PROFILE: 'driving',
        GRIDGO_STORE_LATITUDE: '7.064',
        GRIDGO_STORE_LONGITUDE: '125.6079',
      }),
    );
  });

  it('persists Ven then Mark in one stable versioned plan', async () => {
    const plan = await service.createPlan(rider.id, [mark.id, ven.id]);

    expect(provider.getRoute.mock.calls).toContainEqual([
      [
        { latitude: 7.064, longitude: 125.6079 },
        { latitude: 7.0645, longitude: 125.6079 },
        { latitude: 7.074, longitude: 125.6079 },
      ],
    ]);
    expect(plan.version).toBe(1);
    expect(plan.provider).toBe('osrm');
    expect(plan.stops.map((stop) => stop.assignmentId)).toEqual([
      ven.id,
      mark.id,
    ]);
    expect(plan.stops.map((stop) => stop.sequence)).toEqual([1, 2]);
  });

  it('does not reorder the persisted plan after rider movement', async () => {
    const persisted = {
      id: 501,
      riderId: rider.id,
      status: DispatchPlanStatus.ACTIVE,
      stops: [
        { assignmentId: ven.id, sequence: 1 },
        { assignmentId: mark.id, sequence: 2 },
      ],
    } as DispatchPlan;
    planRepo.findOne!.mockResolvedValue(persisted);
    const plan = await service.getActivePlanForRider(rider.id);

    expect(plan?.stops.map((stop) => stop.assignmentId)).toEqual([
      ven.id,
      mark.id,
    ]);
    expect(provider.getMatrix.mock.calls).toHaveLength(0);
  });

  it('creates nothing and returns routing_unavailable for an initial provider failure', async () => {
    provider.getMatrix.mockRejectedValue(
      new ServiceUnavailableException({ code: 'routing_unavailable' }),
    );

    await expect(
      service.createPlan(rider.id, [mark.id, ven.id]),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'routing_unavailable' }),
    });
    expect(dataSource.transaction!.mock.calls).toHaveLength(0);
    expect(planRepo.save!.mock.calls).toHaveLength(0);
  });

  it('rejects a destination change during transactional revalidation', async () => {
    assignmentRepo.find!.mockResolvedValueOnce([mark, ven]);
    destinationRepo
      .findOneOrFail!.mockResolvedValueOnce(mark.order.destination)
      .mockResolvedValueOnce({
        ...ven.order.destination,
        latitude: 7.099,
      } as DeliveryDestination);

    await expect(
      service.createPlan(rider.id, [mark.id, ven.id]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(planRepo.save!.mock.calls).toHaveLength(0);
  });

  it('asserts and idempotently advances only the first pending stop', async () => {
    const activePlan = {
      id: 501,
      riderId: rider.id,
      status: DispatchPlanStatus.ACTIVE,
    } as DispatchPlan;
    const current = {
      id: 901,
      planId: 501,
      assignmentId: ven.id,
      sequence: 1,
      status: DispatchStopStatus.PENDING,
    } as DispatchPlanStop;
    planRepo.findOne!.mockResolvedValue(activePlan);
    stopRepo.findOne!.mockResolvedValue(current);

    await expect(
      service.assertCurrentStop(manager as EntityManager, rider.id, mark.id),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.assertCurrentStop(manager as EntityManager, rider.id, ven.id);
    await service.advanceStop(
      manager as EntityManager,
      rider.id,
      ven.id,
      DispatchStopStatus.COMPLETED,
    );
    current.status = DispatchStopStatus.COMPLETED;
    await expect(
      service.advanceStop(
        manager as EntityManager,
        rider.id,
        ven.id,
        DispatchStopStatus.COMPLETED,
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    ['duplicates', [mark.id, mark.id]],
    ['none', []],
    ['more than five', [1, 2, 3, 4, 5, 6]],
  ])(
    'rejects %s assignment ids before calling routing',
    async (_label, ids) => {
      await expect(service.createPlan(rider.id, ids)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(provider.getMatrix.mock.calls).toHaveLength(0);
    },
  );

  it('rejects wrong-rider, non-current, or ineligible assignments', async () => {
    assignmentRepo.find!.mockResolvedValue([mark]);
    await expect(
      service.createPlan(rider.id, [mark.id, ven.id]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(provider.getMatrix.mock.calls).toHaveLength(0);
  });

  it('rejects missing destination coordinates before calling routing', async () => {
    assignmentRepo.find!.mockResolvedValue([
      mark,
      {
        ...ven,
        order: {
          ...ven.order,
          destination: { latitude: null, longitude: 125.6079 },
        },
      } as DeliveryAssignment,
    ]);
    await expect(
      service.createPlan(rider.id, [mark.id, ven.id]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(provider.getMatrix.mock.calls).toHaveLength(0);
  });

  it('supersedes the old plan and creates version two without deleting history', async () => {
    const active = {
      id: 400,
      riderId: rider.id,
      version: 1,
      status: DispatchPlanStatus.ACTIVE,
      stops: [],
      routingDataStale: false,
    } as DispatchPlan;
    planRepo
      .findOne!.mockResolvedValueOnce(active)
      .mockResolvedValueOnce(active)
      .mockResolvedValueOnce(active);
    planRepo.save!.mockImplementation(async (value) => {
      const plan = value as DispatchPlan;
      return { ...plan, id: plan.id ?? 501 };
    });

    const result = await service.reoptimizePlan(rider.id, [mark.id, ven.id]);

    expect(active.status).toBe(DispatchPlanStatus.SUPERSEDED);
    expect(active.supersededAt).toBeInstanceOf(Date);
    expect(result.version).toBe(2);
    expect(planRepo.save!.mock.calls).toContainEqual([active]);
  });

  it('retains an active plan and marks routing stale after failed re-optimization', async () => {
    const active = {
      id: 400,
      riderId: rider.id,
      version: 1,
      status: DispatchPlanStatus.ACTIVE,
      stops: [],
      routingDataStale: false,
    } as DispatchPlan;
    planRepo.findOne!.mockResolvedValue(active);
    provider.getMatrix.mockRejectedValue(
      new ServiceUnavailableException({ code: 'routing_unavailable' }),
    );

    await expect(
      service.reoptimizePlan(rider.id, [mark.id, ven.id]),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(planRepo.update!.mock.calls).toContainEqual([
      { id: active.id, status: DispatchPlanStatus.ACTIVE },
      { routingDataStale: true },
    ]);
    expect(active.status).toBe(DispatchPlanStatus.ACTIVE);
  });

  it('fetches routing before entering the persistence transaction', async () => {
    await service.createPlan(rider.id, [mark.id, ven.id]);
    const matrixOrder = provider.getMatrix.mock.invocationCallOrder[0];
    const routeOrder = provider.getRoute.mock.invocationCallOrder[0];
    const transactionOrder =
      dataSource.transaction!.mock.invocationCallOrder[0];
    expect(matrixOrder).toBeLessThan(transactionOrder);
    expect(routeOrder).toBeLessThan(transactionOrder);
    expect(profileRepo.findOne!.mock.calls).toContainEqual([
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    ]);
    expect(orderRepo.findOneOrFail!.mock.calls).toContainEqual([
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    ]);
    expect(assignmentRepo.findOne!.mock.calls).toContainEqual([
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    ]);
  });

  it('fails a second initial create after the rider lock reveals an active plan', async () => {
    planRepo.findOne!.mockResolvedValueOnce({
      id: 400,
      riderId: rider.id,
      version: 1,
      status: DispatchPlanStatus.ACTIVE,
    } as DispatchPlan);
    await expect(
      service.createPlan(rider.id, [mark.id, ven.id]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(stopRepo.save!.mock.calls).toHaveLength(0);
  });

  it('fails closed when delivery advancement has no active plan', async () => {
    planRepo.findOne!.mockResolvedValue(null);
    await expect(
      service.advanceStop(
        manager as EntityManager,
        rider.id,
        ven.id,
        DispatchStopStatus.COMPLETED,
      ),
    ).rejects.toThrow('Dispatch plan is required');
  });

  it('treats retrying the final persisted advancement as idempotent', async () => {
    const completedPlan = {
      id: 501,
      riderId: rider.id,
      version: 1,
      status: DispatchPlanStatus.COMPLETED,
    } as DispatchPlan;
    planRepo
      .findOne!.mockResolvedValueOnce(null)
      .mockResolvedValueOnce(completedPlan);
    stopRepo.findOne!.mockResolvedValueOnce({
      id: 901,
      planId: completedPlan.id,
      assignmentId: ven.id,
      status: DispatchStopStatus.COMPLETED,
    } as DispatchPlanStop);

    await expect(
      service.advanceStop(
        manager as EntityManager,
        rider.id,
        ven.id,
        DispatchStopStatus.COMPLETED,
      ),
    ).resolves.toBeUndefined();
    expect(stopRepo.save!.mock.calls).toHaveLength(0);
  });

  it('allows a pre-plan decline but rejects skipping a planned later stop', async () => {
    planRepo.findOne!.mockResolvedValueOnce(null);
    await expect(
      service.skipStopIfPlanned(manager as EntityManager, rider.id, mark.id),
    ).resolves.toBeUndefined();

    const active = {
      id: 501,
      riderId: rider.id,
      status: DispatchPlanStatus.ACTIVE,
    } as DispatchPlan;
    const later = {
      id: 902,
      planId: active.id,
      assignmentId: mark.id,
      sequence: 2,
      status: DispatchStopStatus.PENDING,
    } as DispatchPlanStop;
    const current = {
      id: 901,
      planId: active.id,
      assignmentId: ven.id,
      sequence: 1,
      status: DispatchStopStatus.PENDING,
    } as DispatchPlanStop;
    planRepo.findOne!.mockResolvedValueOnce(active);
    stopRepo
      .findOne!.mockResolvedValueOnce(later)
      .mockResolvedValueOnce(current);

    await expect(
      service.skipStopIfPlanned(manager as EntityManager, rider.id, mark.id),
    ).rejects.toThrow(
      'Complete the current route stop before advancing this delivery',
    );

    expect(later.status).toBe(DispatchStopStatus.PENDING);
    expect(later.skippedAt).toBeUndefined();
    expect(current.status).toBe(DispatchStopStatus.PENDING);
    expect(active.status).toBe(DispatchPlanStatus.ACTIVE);
  });

  it('marks routing stale when the current planned stop is skipped', async () => {
    const active = {
      id: 501,
      riderId: rider.id,
      status: DispatchPlanStatus.ACTIVE,
      routingDataStale: false,
    } as DispatchPlan;
    const current = {
      id: 901,
      planId: active.id,
      assignmentId: ven.id,
      sequence: 1,
      status: DispatchStopStatus.PENDING,
    } as DispatchPlanStop;
    const next = {
      id: 902,
      planId: active.id,
      assignmentId: mark.id,
      sequence: 2,
      status: DispatchStopStatus.PENDING,
    } as DispatchPlanStop;
    planRepo.findOne!.mockResolvedValueOnce(active);
    stopRepo
      .findOne!.mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(next);

    await service.skipStopIfPlanned(manager as EntityManager, rider.id, ven.id);

    expect(current.status).toBe(DispatchStopStatus.SKIPPED);
    expect(current.skippedAt).toBeInstanceOf(Date);
    expect(active.routingDataStale).toBe(true);
    expect(planRepo.save!.mock.calls).toContainEqual([active]);
  });
});
