import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RiderProfile } from './entities/rider-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from './entities/delivery-assignment.entity';
import { LocationGateway } from './location.gateway';
import { OrdersService } from '../orders/orders.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { BatchOrder } from '../orders/entities/batch-order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { User, UserRole } from '../users/entities/user.entity';

describe('RidersService', () => {
  let service: RidersService;
  let profileRepo: jest.Mocked<Partial<Repository<RiderProfile>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let orderRepo: jest.Mocked<Partial<Repository<Order>>>;
  let batchRepo: jest.Mocked<Partial<Repository<BatchOrder>>>;
  let historyRepo: jest.Mocked<Partial<Repository<OrderStatusHistory>>>;
  let userRepo: jest.Mocked<Partial<Repository<User>>>;
  let dataSource: Partial<DataSource>;
  let locationGateway: Partial<LocationGateway>;
  let ordersService: {
    updateStatus: jest.Mock;
    publishStatusUpdate: jest.Mock;
  };

  const mockProfile = {
    id: 10,
    userId: 1,
    isAvailable: true,
    lastLatitude: 14.5,
    lastLongitude: 121.0,
    lastLocationUpdate: new Date(),
  } as RiderProfile;

  const mockAssignment = {
    id: 100,
    orderId: 1,
    riderId: 10,
    status: DeliveryStatus.ASSIGNED,
    assignedAt: new Date(),
  } as DeliveryAssignment;

  const makeAssignment = (
    id: number,
    latitude: number | null,
    longitude: number | null,
    createdAt = new Date(`2026-05-02T0${id}:00:00Z`),
  ) =>
    ({
      id,
      orderId: id,
      riderId: 10,
      status: DeliveryStatus.ACCEPTED,
      createdAt,
      order: {
        id,
        destination:
          latitude === null || longitude === null
            ? null
            : {
                latitude,
                longitude,
              },
      },
    }) as DeliveryAssignment;

  const mockActiveAssignmentsQuery = (assignments: DeliveryAssignment[]) => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(assignments),
    };
    assignmentRepo.createQueryBuilder.mockReturnValue(queryBuilder as any);
    return queryBuilder;
  };

  beforeEach(async () => {
    profileRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    assignmentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      create: jest.fn((value) => value as DeliveryAssignment),
      createQueryBuilder: jest.fn(),
    };
    orderRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue({
        id: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order),
      update: jest.fn(),
    };
    batchRepo = {
      findOneOrFail: jest.fn(),
    };
    historyRepo = {
      insert: jest.fn(),
    };
    userRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }) => ({
        id: where.id,
        role: UserRole.RIDER,
        isActive: true,
      })),
    };
    const transaction = jest.fn(
      async (
        runInTransaction: (manager: EntityManager) => Promise<unknown>,
      ): Promise<unknown> =>
        runInTransaction({
          getRepository: (entity: { name?: string }) => {
            if (entity?.name === 'Order') return orderRepo;
            if (entity?.name === 'BatchOrder') return batchRepo;
            if (entity?.name === 'DeliveryAssignment') return assignmentRepo;
            if (entity?.name === 'RiderProfile') return profileRepo;
            if (entity?.name === 'OrderStatusHistory') return historyRepo;
            if (entity?.name === 'User') return userRepo;
            throw new Error(`Unexpected repository ${entity?.name}`);
          },
        } as unknown as EntityManager),
    );
    dataSource = {
      getRepository: jest.fn((entity: { name?: string }) => {
        if (entity?.name === 'Order') return orderRepo as Repository<Order>;
        throw new Error(`Unexpected repository ${entity?.name}`);
      }) as DataSource['getRepository'],
      transaction: transaction as unknown as DataSource['transaction'],
    };
    locationGateway = {
      broadcastLocation: jest.fn(),
    };
    ordersService = {
      updateStatus: jest.fn(),
      publishStatusUpdate: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        RidersService,
        { provide: getRepositoryToken(RiderProfile), useValue: profileRepo },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: assignmentRepo,
        },
        { provide: LocationGateway, useValue: locationGateway },
        { provide: OrdersService, useValue: ordersService },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get(RidersService);
  });

  describe('assignOrderToRider', () => {
    it('fails if the order changes batches after the batch lock is chosen', async () => {
      orderRepo.findOneOrFail
        .mockResolvedValueOnce({
          id: 1,
          batchOrderId: 11,
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
        } as Order)
        .mockResolvedValueOnce({
          id: 1,
          batchOrderId: 12,
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
        } as Order);
      batchRepo.findOneOrFail.mockResolvedValue({ id: 11 } as BatchOrder);

      await expect(service.assignOrderToRider(1, 10, 7)).rejects.toThrow(
        'Order batch changed during rider assignment',
      );

      expect(assignmentRepo.findOne).not.toHaveBeenCalled();
      expect(historyRepo.insert).not.toHaveBeenCalled();
    });

    it('rejects assignment before the order is ready for dispatch', async () => {
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        orderStatus: OrderStatus.PRINTING_IN_PROGRESS,
      } as Order);
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        user: {
          id: mockProfile.userId,
          role: UserRole.RIDER,
          isActive: true,
        } as User,
      } as RiderProfile);

      await expect(service.assignOrderToRider(1, 10, 7)).rejects.toThrow(
        'Order is not ready for dispatch',
      );

      expect(assignmentRepo.save).not.toHaveBeenCalled();
      expect(historyRepo.insert).not.toHaveBeenCalled();
    });

    it('creates a current assignment and actor-aware order history atomically', async () => {
      const readyOrder = {
        id: 1,
        orderId: 'ORD-1',
        batchOrderId: null,
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      } as Order;
      const rider = {
        ...mockProfile,
        userId: 21,
        user: {
          id: 21,
          role: UserRole.RIDER,
          isActive: true,
        } as User,
      } as RiderProfile;
      const savedAssignment = {
        id: 301,
        orderId: readyOrder.id,
        riderId: rider.id,
        status: DeliveryStatus.ASSIGNED,
        isCurrent: true,
      } as DeliveryAssignment;
      orderRepo.findOneOrFail.mockResolvedValue(readyOrder);
      orderRepo.update.mockResolvedValue({ affected: 1 } as never);
      assignmentRepo.findOne.mockResolvedValue(null);
      profileRepo.findOne.mockResolvedValue(rider);
      assignmentRepo.save.mockResolvedValue(savedAssignment);
      ordersService.publishStatusUpdate.mockResolvedValue({
        ...readyOrder,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order);

      const result = await service.assignOrderToRider(
        readyOrder.id,
        rider.id,
        7,
      );

      expect(assignmentRepo.create).toHaveBeenCalledWith({
        orderId: readyOrder.id,
        riderId: rider.id,
        status: DeliveryStatus.ASSIGNED,
        isCurrent: true,
      });
      expect(assignmentRepo.save).toHaveBeenCalled();
      expect(orderRepo.update).toHaveBeenCalledWith(
        {
          id: readyOrder.id,
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
        },
        {
          assignedRiderId: rider.userId,
          orderStatus: OrderStatus.RIDER_ASSIGNED,
        },
      );
      expect(historyRepo.insert).toHaveBeenCalledWith({
        orderId: readyOrder.id,
        fromStatus: OrderStatus.READY_FOR_DISPATCH,
        toStatus: OrderStatus.RIDER_ASSIGNED,
        changedByUserId: 7,
        notes: `Admin assigned rider ${rider.id}`,
      });
      expect(result).toMatchObject({
        assignment: savedAssignment,
        riderProfile: rider,
        order: { orderStatus: OrderStatus.RIDER_ASSIGNED },
      });
    });

    it('returns the committed assignment when post-commit customer publication fails', async () => {
      const readyOrder = {
        id: 1,
        orderId: 'ORD-1',
        batchOrderId: null,
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      } as Order;
      const committedOrder = {
        ...readyOrder,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order;
      const rider = {
        ...mockProfile,
        user: {
          id: mockProfile.userId,
          role: UserRole.RIDER,
          isActive: true,
        } as User,
      } as RiderProfile;
      orderRepo.findOneOrFail
        .mockResolvedValueOnce(readyOrder)
        .mockResolvedValueOnce(readyOrder)
        .mockResolvedValueOnce(committedOrder);
      orderRepo.update.mockResolvedValue({ affected: 1 } as never);
      assignmentRepo.findOne.mockResolvedValue(null);
      profileRepo.findOne.mockResolvedValue(rider);
      assignmentRepo.save.mockResolvedValue({
        ...mockAssignment,
        isCurrent: true,
      } as DeliveryAssignment);
      ordersService.publishStatusUpdate.mockRejectedValue(
        new Error('Customer publication failed'),
      );

      await expect(service.assignOrderToRider(1, rider.id, 7)).resolves.toEqual(
        expect.objectContaining({
          order: committedOrder,
          assignment: expect.objectContaining({ isCurrent: true }),
        }),
      );
      expect(historyRepo.insert).toHaveBeenCalledTimes(1);
    });

    it('returns a deterministic conflict for a repeated assignment', async () => {
      const assignedOrder = {
        id: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order;
      orderRepo.findOneOrFail.mockResolvedValue(assignedOrder);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        isCurrent: true,
      } as DeliveryAssignment);

      await expect(service.assignOrderToRider(1, 10, 7)).rejects.toThrow(
        'Order already has an assignment',
      );

      expect(profileRepo.findOne).not.toHaveBeenCalled();
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('converts a current-assignment unique violation to a conflict', async () => {
      const readyOrder = {
        id: 1,
        batchOrderId: null,
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      } as Order;
      orderRepo.findOneOrFail.mockResolvedValue(readyOrder);
      assignmentRepo.findOne.mockResolvedValue(null);
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        user: {
          id: mockProfile.userId,
          role: UserRole.RIDER,
          isActive: true,
        } as User,
      } as RiderProfile);
      assignmentRepo.save.mockRejectedValue(
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_delivery_assignments_current_order',
        }),
      );

      await expect(service.assignOrderToRider(1, 10, 7)).rejects.toThrow(
        'Order already has an assignment',
      );

      expect(orderRepo.update).not.toHaveBeenCalled();
      expect(historyRepo.insert).not.toHaveBeenCalled();
    });

    it.each([
      ['offline', false, true, UserRole.RIDER],
      ['inactive', true, false, UserRole.RIDER],
      ['non-rider', true, true, UserRole.CUSTOMER],
    ])(
      'rejects an %s rider profile',
      async (_label, isAvailable, isActive, role) => {
        const readyOrder = {
          id: 1,
          batchOrderId: null,
          deliveryOption: 'delivery',
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
        } as Order;
        orderRepo.findOneOrFail.mockResolvedValue(readyOrder);
        assignmentRepo.findOne.mockResolvedValue(null);
        profileRepo.findOne.mockResolvedValue({
          ...mockProfile,
          isAvailable,
          user: {
            id: mockProfile.userId,
            role,
            isActive,
          } as User,
        } as RiderProfile);
        userRepo.findOne.mockResolvedValue({
          id: mockProfile.userId,
          role,
          isActive,
        } as User);

        await expect(service.assignOrderToRider(1, 10, 7)).rejects.toThrow(
          'Rider is not available for assignment',
        );

        expect(assignmentRepo.save).not.toHaveBeenCalled();
        expect(orderRepo.update).not.toHaveBeenCalled();
      },
    );

    it.each(['pickup', null, 'legacy-option'])(
      'rejects rider assignment for non-delivery option %s',
      async (deliveryOption) => {
        const readyOrder = {
          id: 1,
          batchOrderId: null,
          deliveryOption,
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
        } as Order;
        orderRepo.findOneOrFail.mockResolvedValue(readyOrder);
        assignmentRepo.findOne.mockResolvedValue(null);

        await expect(service.assignOrderToRider(1, 10, 7)).rejects.toThrow(
          'Rider assignment requires a delivery order',
        );

        expect(profileRepo.findOne).not.toHaveBeenCalled();
        expect(assignmentRepo.save).not.toHaveBeenCalled();
        expect(orderRepo.update).not.toHaveBeenCalled();
        expect(historyRepo.insert).not.toHaveBeenCalled();
      },
    );
  });

  describe('getProfile', () => {
    it('should return rider profile', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);

      const result = await service.getProfile(1);

      expect(profileRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 1 },
        relations: ['user'],
      });
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('setAvailability', () => {
    it('should toggle rider to online', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        isAvailable: false,
      } as RiderProfile);
      profileRepo.save.mockImplementation(async (p) => p as RiderProfile);

      const result = await service.setAvailability(1, true);

      expect(result.isAvailable).toBe(true);
      expect(profileRepo.save).toHaveBeenCalled();
    });

    it('should toggle rider to offline', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        isAvailable: true,
      } as RiderProfile);
      profileRepo.save.mockImplementation(async (p) => p as RiderProfile);

      const result = await service.setAvailability(1, false);

      expect(result.isAvailable).toBe(false);
    });
  });

  describe('updateDeliveryStatus', () => {
    it('writes rider status history in the assignment transaction', async () => {
      const acceptedAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.ACCEPTED,
        isCurrent: true,
      } as DeliveryAssignment;
      const assignedOrder = {
        id: acceptedAssignment.orderId,
        orderId: 'ORD-1',
        batchOrderId: null,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order;
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue(acceptedAssignment);
      assignmentRepo.save.mockImplementation(
        async (assignment) => assignment as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue(assignedOrder);
      orderRepo.update.mockResolvedValue({ affected: 1 } as never);
      ordersService.publishStatusUpdate.mockResolvedValue({
        ...assignedOrder,
        orderStatus: OrderStatus.PICKED_UP,
      } as Order);

      const result = await service.updateDeliveryStatus(
        mockProfile.userId,
        acceptedAssignment.id,
        DeliveryStatus.PICKED_UP,
      );

      expect(result.status).toBe(DeliveryStatus.PICKED_UP);
      expect(orderRepo.update).toHaveBeenCalledWith(
        {
          id: assignedOrder.id,
          orderStatus: OrderStatus.RIDER_ASSIGNED,
        },
        { orderStatus: OrderStatus.PICKED_UP },
      );
      expect(historyRepo.insert).toHaveBeenCalledWith({
        orderId: assignedOrder.id,
        fromStatus: OrderStatus.RIDER_ASSIGNED,
        toStatus: OrderStatus.PICKED_UP,
        changedByUserId: mockProfile.userId,
        notes: 'Rider updated delivery to picked_up',
      });
      expect(ordersService.updateStatus).not.toHaveBeenCalled();
      expect(ordersService.publishStatusUpdate).toHaveBeenCalledWith(
        assignedOrder,
        assignedOrder.id,
        OrderStatus.PICKED_UP,
      );
    });

    it('returns the committed delivery update when publication fails', async () => {
      const acceptedAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.ACCEPTED,
        isCurrent: true,
      } as DeliveryAssignment;
      const assignedOrder = {
        id: acceptedAssignment.orderId,
        orderId: 'ORD-1',
        batchOrderId: null,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order;
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue(acceptedAssignment);
      assignmentRepo.save.mockImplementation(
        async (assignment) => assignment as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue(assignedOrder);
      orderRepo.update.mockResolvedValue({ affected: 1 } as never);
      ordersService.publishStatusUpdate.mockRejectedValue(
        new Error('Publication unavailable'),
      );

      await expect(
        service.updateDeliveryStatus(
          mockProfile.userId,
          acceptedAssignment.id,
          DeliveryStatus.PICKED_UP,
        ),
      ).resolves.toMatchObject({ status: DeliveryStatus.PICKED_UP });

      expect(historyRepo.insert).toHaveBeenCalledTimes(1);
    });

    it('closes a declined assignment so reassignment preserves its audit row', async () => {
      const assignedAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.ASSIGNED,
        isCurrent: true,
      } as DeliveryAssignment;
      const assignedOrder = {
        id: assignedAssignment.orderId,
        orderId: 'ORD-1',
        batchOrderId: null,
        assignedRiderId: mockProfile.userId,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order;
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue(assignedAssignment);
      assignmentRepo.save.mockImplementation(
        async (assignment) => assignment as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue(assignedOrder);
      orderRepo.update.mockResolvedValue({ affected: 1 } as never);
      ordersService.publishStatusUpdate.mockResolvedValue({
        ...assignedOrder,
        assignedRiderId: null,
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      } as Order);

      const result = await service.updateDeliveryStatus(
        mockProfile.userId,
        assignedAssignment.id,
        DeliveryStatus.DECLINED,
        'Too far',
      );

      expect(result).toMatchObject({
        status: DeliveryStatus.DECLINED,
        isCurrent: false,
        declineReason: 'Too far',
      });
      expect(orderRepo.update).toHaveBeenCalledWith(
        {
          id: assignedOrder.id,
          orderStatus: OrderStatus.RIDER_ASSIGNED,
        },
        {
          assignedRiderId: null,
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
        },
      );
      expect(historyRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: assignedOrder.id,
          changedByUserId: mockProfile.userId,
          fromStatus: OrderStatus.RIDER_ASSIGNED,
          toStatus: OrderStatus.READY_FOR_DISPATCH,
          notes: 'Rider declined assignment: Too far',
        }),
      );
    });

    it('should transition from ASSIGNED to ACCEPTED', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
      } as DeliveryAssignment);
      assignmentRepo.save.mockImplementation(
        async (a) => a as DeliveryAssignment,
      );

      const result = await service.updateDeliveryStatus(
        1,
        100,
        DeliveryStatus.ACCEPTED,
      );

      expect(result.status).toBe(DeliveryStatus.ACCEPTED);
      expect(result.acceptedAt).toBeDefined();
      expect(historyRepo.insert).not.toHaveBeenCalled();
      expect(ordersService.publishStatusUpdate).not.toHaveBeenCalled();
    });

    it('rejects marking an assignment delivered without proof of delivery', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);

      await expect(
        service.updateDeliveryStatus(1, 100, DeliveryStatus.DELIVERED),
      ).rejects.toThrow('Proof of delivery is required');
      expect(assignmentRepo.save).not.toHaveBeenCalled();
      expect(ordersService.updateStatus).not.toHaveBeenCalled();
    });

    it('uses OrdersService status side effects when marking an assignment delivered with photo proof', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);
      assignmentRepo.save.mockImplementation(
        async (a) => a as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
      } as Order);

      const result = await (service.updateDeliveryStatus as any)(
        1,
        100,
        DeliveryStatus.DELIVERED,
        undefined,
        { type: 'photo', fileId: 55, objectKey: 'uploads/pod/55.jpg' },
      );

      expect(result.status).toBe(DeliveryStatus.DELIVERED);
      expect(result.deliveredAt).toBeDefined();
      expect(result.proofType).toBe('photo');
      expect(result.proofFileId).toBe(55);
      expect(result.proofObjectKey).toBe('uploads/pod/55.jpg');
      expect(result.proofCapturedAt).toBeDefined();
      expect(result.proofCapturedByRiderId).toBe(mockProfile.id);
      expect(result.proofSignatureData).toBeNull();
      expect(ordersService.publishStatusUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        }),
        1,
        OrderStatus.DELIVERED,
      );
    });

    it('marks an assignment delivered with signature proof', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);
      assignmentRepo.save.mockImplementation(
        async (a) => a as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
      } as Order);

      const result = await (service.updateDeliveryStatus as any)(
        1,
        100,
        DeliveryStatus.DELIVERED,
        undefined,
        { type: 'signature', signatureData: 'svg:path-data' },
      );

      expect(result.status).toBe(DeliveryStatus.DELIVERED);
      expect(result.deliveredAt).toBeDefined();
      expect(result.proofType).toBe('signature');
      expect(result.proofSignatureData).toBe('svg:path-data');
      expect(result.proofCapturedAt).toBeDefined();
      expect(result.proofCapturedByRiderId).toBe(mockProfile.id);
      expect(result.proofFileId).toBeNull();
      expect(result.proofObjectKey).toBeNull();
    });

    it('should transition from ASSIGNED to DECLINED', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
      } as DeliveryAssignment);
      assignmentRepo.save.mockImplementation(
        async (a) => a as DeliveryAssignment,
      );

      const result = await service.updateDeliveryStatus(
        1,
        100,
        DeliveryStatus.DECLINED,
        'Too far',
      );

      expect(result.status).toBe(DeliveryStatus.DECLINED);
      expect(result.declineReason).toBe('Too far');
      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1, orderStatus: OrderStatus.RIDER_ASSIGNED },
        {
          assignedRiderId: null,
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
        },
      );
    });

    it('should throw BadRequestException on invalid transition ASSIGNED -> DELIVERED', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
      } as DeliveryAssignment);

      await expect(
        service.updateDeliveryStatus(1, 100, DeliveryStatus.DELIVERED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on invalid transition DELIVERED -> ASSIGNED', async () => {
      const deliveredAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.DELIVERED,
      } as DeliveryAssignment;
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue(deliveredAssignment);

      await expect(
        service.updateDeliveryStatus(1, 100, DeliveryStatus.ASSIGNED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should follow full valid transition chain', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.save.mockImplementation(
        async (a) => a as DeliveryAssignment,
      );
      const orderStatuses = [
        OrderStatus.RIDER_ASSIGNED,
        OrderStatus.RIDER_ASSIGNED,
        OrderStatus.PICKED_UP,
        OrderStatus.ON_THE_WAY,
        OrderStatus.ARRIVED_AT_DESTINATION,
      ];
      let orderRead = 0;
      orderRepo.findOneOrFail.mockImplementation(
        async () =>
          ({
            id: 1,
            batchOrderId: null,
            orderStatus: orderStatuses[Math.floor(orderRead++ / 2)],
          }) as Order,
      );

      // ASSIGNED -> ACCEPTED
      const assigned = {
        ...mockAssignment,
        status: DeliveryStatus.ASSIGNED,
      } as DeliveryAssignment;
      assignmentRepo.findOne.mockResolvedValue(assigned);
      const accepted = await service.updateDeliveryStatus(
        1,
        100,
        DeliveryStatus.ACCEPTED,
      );
      expect(accepted.status).toBe(DeliveryStatus.ACCEPTED);

      // ACCEPTED -> PICKED_UP
      const acceptedAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.ACCEPTED,
      } as DeliveryAssignment;
      assignmentRepo.findOne.mockResolvedValue(acceptedAssignment);
      const pickedUp = await service.updateDeliveryStatus(
        1,
        100,
        DeliveryStatus.PICKED_UP,
      );
      expect(pickedUp.status).toBe(DeliveryStatus.PICKED_UP);

      // PICKED_UP -> ON_THE_WAY
      const pickedUpAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.PICKED_UP,
      } as DeliveryAssignment;
      assignmentRepo.findOne.mockResolvedValue(pickedUpAssignment);
      const otw = await service.updateDeliveryStatus(
        1,
        100,
        DeliveryStatus.ON_THE_WAY,
      );
      expect(otw.status).toBe(DeliveryStatus.ON_THE_WAY);
      expect(ordersService.publishStatusUpdate).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderStatus: OrderStatus.PICKED_UP }),
        1,
        OrderStatus.ON_THE_WAY,
      );

      // ON_THE_WAY -> ARRIVED
      const otwAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.ON_THE_WAY,
      } as DeliveryAssignment;
      assignmentRepo.findOne.mockResolvedValue(otwAssignment);
      mockActiveAssignmentsQuery([otwAssignment]);
      const arrived = await service.updateDeliveryStatus(
        1,
        100,
        DeliveryStatus.ARRIVED,
      );
      expect(arrived.status).toBe(DeliveryStatus.ARRIVED);

      // ARRIVED -> DELIVERED
      const arrivedAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment;
      assignmentRepo.findOne.mockResolvedValue(arrivedAssignment);
      const delivered = await (service.updateDeliveryStatus as any)(
        1,
        100,
        DeliveryStatus.DELIVERED,
        undefined,
        { type: 'signature', signatureData: 'svg:path-data' },
      );
      expect(delivered.status).toBe(DeliveryStatus.DELIVERED);
      expect(delivered.deliveredAt).toBeDefined();
    });

    it('rejects arriving at a later route stop before the current stop', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      const current = makeAssignment(1, 14.51, 121.01);
      current.status = DeliveryStatus.ON_THE_WAY;
      const later = {
        ...makeAssignment(2, 15.5, 122.0),
        id: 100,
        status: DeliveryStatus.ON_THE_WAY,
      } as DeliveryAssignment;
      assignmentRepo.findOne.mockResolvedValue(later);
      orderRepo.findOneOrFail.mockResolvedValue({
        id: later.orderId,
        batchOrderId: null,
        orderStatus: OrderStatus.ON_THE_WAY,
      } as Order);
      mockActiveAssignmentsQuery([later, current]);

      await expect(
        service.updateDeliveryStatus(1, 100, DeliveryStatus.ARRIVED),
      ).rejects.toThrow(
        'Complete the current route stop before advancing this delivery',
      );
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if assignment not found', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateDeliveryStatus(1, 999, DeliveryStatus.ACCEPTED),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActiveAssignments', () => {
    it('orders active assignments by nearest route from the rider location', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        lastLatitude: 7.064,
        lastLongitude: 125.608,
      } as RiderProfile);
      const farFirstFromDb = makeAssignment(1, 7.22, 125.72);
      const nearestFromShop = makeAssignment(2, 7.065, 125.609);
      const secondStop = makeAssignment(3, 7.08, 125.62);
      mockActiveAssignmentsQuery([farFirstFromDb, secondStop, nearestFromShop]);

      const result = await service.getActiveAssignments(1);

      const queryBuilder = assignmentRepo.createQueryBuilder.mock.results[0]
        .value as {
        leftJoinAndSelect: jest.Mock;
      };
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'order.destination',
        'destination',
      );
      expect(result.map((assignment) => assignment.id)).toEqual([2, 3, 1]);
    });

    it('falls back to shop location when rider GPS is partially missing', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        lastLatitude: null,
        lastLongitude: 125.608,
      } as RiderProfile);
      const nearShop = makeAssignment(1, 7.065, 125.609);
      const nearInvalidPartialGps = makeAssignment(2, 0.1, 125.608);
      mockActiveAssignmentsQuery([nearInvalidPartialGps, nearShop]);

      const result = await service.getActiveAssignments(1);

      expect(result.map((assignment) => assignment.id)).toEqual([1, 2]);
    });

    it('keeps assignments without destination coordinates after routeable stops', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        lastLatitude: null,
        lastLongitude: null,
      } as RiderProfile);
      const missingCoordinates = makeAssignment(1, null, null);
      const routeable = makeAssignment(2, 7.065, 125.609);
      mockActiveAssignmentsQuery([missingCoordinates, routeable]);

      const result = await service.getActiveAssignments(1);

      expect(result.map((assignment) => assignment.id)).toEqual([2, 1]);
    });

    it('keeps partially geocoded destinations after routeable stops', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        lastLatitude: 7.064,
        lastLongitude: 125.608,
      } as RiderProfile);
      const partialCoordinates = makeAssignment(1, null, 125.609);
      const routeable = makeAssignment(2, 7.22, 125.72);
      mockActiveAssignmentsQuery([partialCoordinates, routeable]);

      const result = await service.getActiveAssignments(1);

      expect(result.map((assignment) => assignment.id)).toEqual([2, 1]);
    });
  });
});
