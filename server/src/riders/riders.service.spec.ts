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
import {
  Conversation,
  ConversationStatus,
  ConversationType,
} from '../chat/entities/conversation.entity';
import { ChatGateway } from '../chat/chat.gateway';
import { FilesService } from '../files/files.service';
import { DispatchPlanService } from './dispatch-plan.service';
import { DispatchPlanStatus } from './entities/dispatch-plan.entity';
import { DispatchStopStatus } from './entities/dispatch-plan-stop.entity';
import { OrdersGateway } from '../orders/orders.gateway';

describe('RidersService', () => {
  let service: RidersService;
  let profileRepo: jest.Mocked<Partial<Repository<RiderProfile>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let orderRepo: jest.Mocked<Partial<Repository<Order>>>;
  let batchRepo: jest.Mocked<Partial<Repository<BatchOrder>>>;
  let historyRepo: jest.Mocked<Partial<Repository<OrderStatusHistory>>>;
  let userRepo: jest.Mocked<Partial<Repository<User>>>;
  let conversationRepo: jest.Mocked<Partial<Repository<Conversation>>>;
  let dataSource: Partial<DataSource>;
  let locationGateway: Partial<LocationGateway>;
  let ordersGateway: { notifyDeliveryQueueUpdated: jest.Mock };
  let chatGateway: { notifyConversationClosed: jest.Mock };
  let ordersService: {
    updateStatus: jest.Mock;
    publishStatusUpdate: jest.Mock;
    completeDelivery: jest.Mock;
  };
  let filesService: { resolveDeliveryProofFile: jest.Mock };
  let dispatchPlanService: {
    createPlan: jest.Mock;
    reoptimizePlan: jest.Mock;
    getActivePlanForRider: jest.Mock;
    getActivePlanForRiderUser: jest.Mock;
    getCurrentPendingStopForRider: jest.Mock;
    assertCurrentStop: jest.Mock;
    advanceStop: jest.Mock;
    skipStopIfPlanned: jest.Mock;
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
      find: jest.fn(),
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
    conversationRepo = {
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
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
            if (entity?.name === 'Conversation') return conversationRepo;
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
    ordersGateway = {
      notifyDeliveryQueueUpdated: jest.fn(),
    };
    chatGateway = {
      notifyConversationClosed: jest.fn(),
    };
    ordersService = {
      updateStatus: jest.fn(),
      publishStatusUpdate: jest.fn(),
      completeDelivery: jest.fn(),
    };
    filesService = {
      resolveDeliveryProofFile: jest.fn(),
    };
    dispatchPlanService = {
      createPlan: jest.fn(),
      reoptimizePlan: jest.fn(),
      getActivePlanForRider: jest.fn().mockResolvedValue(null),
      getActivePlanForRiderUser: jest.fn().mockResolvedValue(null),
      getCurrentPendingStopForRider: jest.fn().mockResolvedValue(null),
      assertCurrentStop: jest.fn().mockResolvedValue(undefined),
      advanceStop: jest.fn().mockResolvedValue(undefined),
      skipStopIfPlanned: jest.fn().mockResolvedValue(undefined),
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
        { provide: OrdersGateway, useValue: ordersGateway },
        { provide: OrdersService, useValue: ordersService },
        { provide: FilesService, useValue: filesService },
        { provide: ChatGateway, useValue: chatGateway },
        { provide: DataSource, useValue: dataSource },
        { provide: DispatchPlanService, useValue: dispatchPlanService },
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

  describe('getAllRidersWithUser', () => {
    it.each([
      ['eligible', true, true, UserRole.RIDER, true],
      ['unavailable', false, true, UserRole.RIDER, false],
      ['inactive', true, false, UserRole.RIDER, false],
      ['wrong role', true, true, UserRole.CUSTOMER, false],
    ])(
      'projects %s assignment eligibility from server-owned identity state',
      async (_label, isAvailable, isActive, role, expected) => {
        profileRepo.find.mockResolvedValue([
          {
            ...mockProfile,
            isAvailable,
            user: {
              id: mockProfile.userId,
              fullName: 'Juan Rider',
              email: 'juan@example.test',
              isActive,
              role,
            } as User,
          } as RiderProfile,
        ]);

        await expect(service.getAllRidersWithUser()).resolves.toEqual([
          expect.objectContaining({
            id: mockProfile.id,
            is_available: isAvailable,
            assignment_eligible: expected,
          }),
        ]);
      },
    );
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

    it('rolls back delivery and emits nothing when survey creation fails', async () => {
      const arrivedAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
        isCurrent: true,
      } as DeliveryAssignment;
      const arrivedOrder = {
        id: arrivedAssignment.orderId,
        orderId: 'ORD-1',
        batchOrderId: null,
        orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
      } as Order;
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue(arrivedAssignment);
      assignmentRepo.save.mockImplementation(
        async (assignment) => assignment as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue(arrivedOrder);
      ordersService.completeDelivery.mockRejectedValue(
        new Error('survey insert failed'),
      );

      await expect(
        service.updateDeliveryStatus(
          mockProfile.userId,
          arrivedAssignment.id,
          DeliveryStatus.DELIVERED,
          undefined,
          { type: 'signature', signatureData: 'svg:rollback' } as any,
        ),
      ).rejects.toThrow('survey insert failed');

      expect(ordersService.publishStatusUpdate).not.toHaveBeenCalled();
      expect(locationGateway.broadcastLocation).not.toHaveBeenCalled();
      expect(ordersGateway.notifyDeliveryQueueUpdated).not.toHaveBeenCalled();
      expect(chatGateway.notifyConversationClosed).not.toHaveBeenCalled();
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

    it('closes the current rider chats in the decline transaction and revokes their rooms after commit', async () => {
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
      const conversation = {
        id: 501,
        orderId: assignedOrder.id,
        type: ConversationType.RIDER,
        assignedRiderId: mockProfile.userId,
        status: ConversationStatus.OPEN,
      } as Conversation;
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue(assignedAssignment);
      assignmentRepo.save.mockImplementation(
        async (assignment) => assignment as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue(assignedOrder);
      orderRepo.update.mockResolvedValue({ affected: 1 } as never);
      conversationRepo.find.mockResolvedValue([conversation]);

      await service.updateDeliveryStatus(
        mockProfile.userId,
        assignedAssignment.id,
        DeliveryStatus.DECLINED,
        'Too far',
      );

      expect(conversationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderId: assignedOrder.id,
            type: ConversationType.RIDER,
            assignedRiderId: mockProfile.userId,
          }),
          lock: { mode: 'pessimistic_write' },
        }),
      );
      expect(conversationRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.anything() }),
        expect.objectContaining({
          status: ConversationStatus.CLOSED,
          closedAt: expect.any(Date),
        }),
      );
      expect(chatGateway.notifyConversationClosed).toHaveBeenCalledWith([501]);
      expect(historyRepo.insert).toHaveBeenCalledTimes(1);
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
      const surveyRequirement = { id: 70 };
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          batchOrderId: null,
          orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        },
        surveyRequirement,
      });
      filesService.resolveDeliveryProofFile.mockResolvedValue({
        id: 55,
        objectKey: 'uploads/proof_of_delivery/server-55.jpg',
      });

      const result = await (service.updateDeliveryStatus as any)(
        1,
        100,
        DeliveryStatus.DELIVERED,
        undefined,
        { type: 'photo', fileId: 55, objectKey: 'spoofed/client-key.jpg' },
      );

      expect(result.status).toBe(DeliveryStatus.DELIVERED);
      expect(result.deliveredAt).toBeDefined();
      expect(result.proofType).toBe('photo');
      expect(result.proofFileId).toBe(55);
      expect(result.proofObjectKey).toBe(
        'uploads/proof_of_delivery/server-55.jpg',
      );
      expect(filesService.resolveDeliveryProofFile).toHaveBeenCalledWith(
        55,
        mockProfile.userId,
        expect.objectContaining({ getRepository: expect.any(Function) }),
      );
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
        surveyRequirement,
      );
    });

    it('notifies only the persisted next customer after delivery commits', async () => {
      const venAssignment = {
        ...mockAssignment,
        id: 100,
        status: DeliveryStatus.ARRIVED,
        isCurrent: true,
      } as DeliveryAssignment;
      const markAssignment = {
        ...mockAssignment,
        id: 101,
        orderId: 2,
        status: DeliveryStatus.ON_THE_WAY,
        isCurrent: true,
        order: { id: 2, orderId: 'MARK-2', userId: 22 },
      } as DeliveryAssignment;
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne
        .mockResolvedValueOnce(venAssignment)
        .mockResolvedValueOnce(venAssignment)
        .mockResolvedValueOnce(markAssignment);
      assignmentRepo.save.mockImplementation(
        async (assignment) => assignment as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        orderId: 'VEN-1',
        userId: 21,
        batchOrderId: null,
        orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
      } as Order);
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          orderId: 'VEN-1',
          userId: 21,
          batchOrderId: null,
          orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        },
        surveyRequirement: { id: 70 },
      });
      dispatchPlanService.getActivePlanForRider.mockResolvedValue({
        id: 500,
        riderId: mockProfile.id,
        version: 4,
        status: DispatchPlanStatus.ACTIVE,
        stops: [
          {
            assignmentId: venAssignment.id,
            sequence: 1,
            status: DispatchStopStatus.COMPLETED,
          },
          {
            assignmentId: markAssignment.id,
            sequence: 2,
            status: DispatchStopStatus.PENDING,
          },
        ],
      });

      await service.updateDeliveryStatus(
        mockProfile.userId,
        venAssignment.id,
        DeliveryStatus.DELIVERED,
        undefined,
        { type: 'signature', signatureData: 'svg:ven-proof' } as any,
      );

      expect(ordersGateway.notifyDeliveryQueueUpdated).toHaveBeenCalledWith(
        22,
        {
          orderId: 2,
          orderRef: 'MARK-2',
          queuePosition: 1,
          queueSize: 1,
          canTrackDelivery: true,
          assignmentId: 101,
          planVersion: 4,
        },
      );
      expect(ordersGateway.notifyDeliveryQueueUpdated).not.toHaveBeenCalledWith(
        21,
        expect.anything(),
      );
      expect(
        ordersGateway.notifyDeliveryQueueUpdated.mock.invocationCallOrder[0],
      ).toBeLessThan(
        ordersService.publishStatusUpdate.mock.invocationCallOrder[0],
      );
    });

    it('publishes queue promotion independently of other post-commit failures', async () => {
      const arrived = {
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
        isCurrent: true,
      } as DeliveryAssignment;
      const next = {
        ...mockAssignment,
        id: 102,
        orderId: 3,
        status: DeliveryStatus.ASSIGNED,
        isCurrent: true,
        order: { id: 3, orderId: 'NEXT-3', userId: 23 },
      } as DeliveryAssignment;
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne
        .mockResolvedValueOnce(arrived)
        .mockResolvedValueOnce(arrived)
        .mockResolvedValueOnce(next);
      assignmentRepo.save.mockImplementation(
        async (assignment) => assignment as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        orderId: 'VEN-1',
        userId: 21,
        batchOrderId: null,
        orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
      } as Order);
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          orderId: 'VEN-1',
          userId: 21,
          batchOrderId: null,
          orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        },
        surveyRequirement: null,
      });
      ordersService.publishStatusUpdate.mockRejectedValue(
        new Error('order publication failed'),
      );
      dispatchPlanService.getActivePlanForRider.mockResolvedValue({
        id: 500,
        riderId: mockProfile.id,
        version: 5,
        status: DispatchPlanStatus.ACTIVE,
        stops: [
          {
            assignmentId: next.id,
            sequence: 2,
            status: DispatchStopStatus.PENDING,
          },
        ],
      });

      await expect(
        service.updateDeliveryStatus(
          mockProfile.userId,
          arrived.id,
          DeliveryStatus.DELIVERED,
          undefined,
          { type: 'signature', signatureData: 'svg:proof' } as any,
        ),
      ).resolves.toMatchObject({ status: DeliveryStatus.DELIVERED });

      expect(ordersGateway.notifyDeliveryQueueUpdated).toHaveBeenCalledWith(
        23,
        expect.objectContaining({
          canTrackDelivery: false,
          assignmentId: null,
          planVersion: 5,
        }),
      );
    });

    it.each(['lookup', 'gateway'] as const)(
      'keeps committed order publication successful when promotion %s fails',
      async (failure) => {
        const arrived = {
          ...mockAssignment,
          status: DeliveryStatus.ARRIVED,
          isCurrent: true,
        } as DeliveryAssignment;
        const next = {
          ...mockAssignment,
          id: 103,
          orderId: 4,
          status: DeliveryStatus.ON_THE_WAY,
          isCurrent: true,
          order: { id: 4, orderId: 'NEXT-4', userId: 24 },
        } as DeliveryAssignment;
        profileRepo.findOne.mockResolvedValue(mockProfile);
        assignmentRepo.findOne
          .mockResolvedValueOnce(arrived)
          .mockResolvedValueOnce(arrived);
        if (failure === 'lookup') {
          assignmentRepo.findOne.mockRejectedValueOnce(
            new Error('promotion lookup failed'),
          );
        } else {
          assignmentRepo.findOne.mockResolvedValueOnce(next);
          ordersGateway.notifyDeliveryQueueUpdated.mockImplementation(() => {
            throw new Error('promotion gateway failed');
          });
        }
        assignmentRepo.save.mockImplementation(
          async (assignment) => assignment as DeliveryAssignment,
        );
        orderRepo.findOneOrFail.mockResolvedValue({
          id: 1,
          orderId: 'VEN-1',
          userId: 21,
          batchOrderId: null,
          orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        } as Order);
        const previous = {
          id: 1,
          orderId: 'VEN-1',
          userId: 21,
          batchOrderId: null,
          orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        } as Order;
        ordersService.completeDelivery.mockResolvedValue({
          previous,
          surveyRequirement: { id: 70 },
        });
        dispatchPlanService.getActivePlanForRider.mockResolvedValue({
          id: 500,
          riderId: mockProfile.id,
          version: 6,
          status: DispatchPlanStatus.ACTIVE,
          stops: [
            {
              assignmentId: next.id,
              sequence: 2,
              status: DispatchStopStatus.PENDING,
            },
          ],
        });

        await expect(
          service.updateDeliveryStatus(
            mockProfile.userId,
            arrived.id,
            DeliveryStatus.DELIVERED,
            undefined,
            { type: 'signature', signatureData: 'svg:proof' } as any,
          ),
        ).resolves.toMatchObject({ status: DeliveryStatus.DELIVERED });

        expect(ordersService.publishStatusUpdate).toHaveBeenCalledWith(
          previous,
          previous.id,
          OrderStatus.DELIVERED,
          { id: 70 },
        );
      },
    );

    it('rejects photo proof owned by another user', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
      } as Order);
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          batchOrderId: null,
          orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        },
        surveyRequirement: null,
      });
      filesService.resolveDeliveryProofFile.mockRejectedValue(
        new BadRequestException('Proof file does not belong to this rider'),
      );

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.DELIVERED,
          undefined,
          { type: 'photo', fileId: 44 } as any,
        ),
      ).rejects.toThrow('Proof file does not belong to this rider');

      expect(assignmentRepo.save).not.toHaveBeenCalled();
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
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          batchOrderId: null,
          orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        },
        surveyRequirement: null,
      });

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

    it('rejects an oversized signature by normalized UTF-8 byte length', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
      } as Order);

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.DELIVERED,
          undefined,
          {
            type: 'signature',
            signatureData: ` ${'🙂'.repeat(16_385)} `,
          } as any,
        ),
      ).rejects.toThrow('Signature proof is too large');

      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      {
        type: 'photo',
        fileId: 55,
        signatureData: 'mixed-signature',
      },
      {
        type: 'signature',
        signatureData: 'signature',
        fileId: 55,
      },
    ])('rejects unsupported mixed proof payload %#', async (proof) => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
      } as Order);

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.DELIVERED,
          undefined,
          proof as any,
        ),
      ).rejects.toThrow('Unsupported mixed proof payload');

      expect(assignmentRepo.save).not.toHaveBeenCalled();
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
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          batchOrderId: null,
          orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        },
        surveyRequirement: null,
      });
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
      dispatchPlanService.assertCurrentStop.mockRejectedValueOnce(
        new BadRequestException(
          'Complete the current route stop before advancing this delivery',
        ),
      );

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
    it('broadcasts the persisted plan version with current-stop location updates', async () => {
      profileRepo.findOne.mockResolvedValue({ ...mockProfile });
      profileRepo.save.mockImplementation(
        async (profile) => profile as RiderProfile,
      );
      dispatchPlanService.getCurrentPendingStopForRider.mockResolvedValue({
        stop: {
          assignmentId: 100,
          sequence: 1,
          status: DispatchStopStatus.PENDING,
        },
        planVersion: 4,
      });
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        isCurrent: true,
        status: DeliveryStatus.ON_THE_WAY,
      } as DeliveryAssignment);

      await service.updateLocation(1, {
        latitude: 7.06405,
        longitude: 125.60795,
      });

      expect(locationGateway.broadcastLocation).toHaveBeenCalledWith('100', {
        assignmentId: '100',
        planVersion: 4,
        latitude: 7.06405,
        longitude: 125.60795,
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
        ),
      });
    });

    it('orders active assignments by the persisted dispatch plan', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        lastLatitude: 7.064,
        lastLongitude: 125.608,
      } as RiderProfile);
      const farFirstFromDb = makeAssignment(1, 7.22, 125.72);
      const nearestFromShop = makeAssignment(2, 7.065, 125.609);
      const secondStop = makeAssignment(3, 7.08, 125.62);
      mockActiveAssignmentsQuery([farFirstFromDb, secondStop, nearestFromShop]);
      dispatchPlanService.getActivePlanForRider.mockResolvedValue({
        id: 500,
        riderId: 10,
        version: 3,
        status: DispatchPlanStatus.ACTIVE,
        stops: [2, 3, 1].map((assignmentId, index) => ({
          assignmentId,
          sequence: index + 1,
          status: DispatchStopStatus.PENDING,
          destinationLatitude: 7.064 + index / 100,
          destinationLongitude: 125.608 + index / 100,
          legDurationSeconds: 30,
          legDistanceMeters: 100,
          legGeometry: { type: 'LineString', coordinates: [] },
        })),
      });

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
      expect((result[0] as any).dispatchPlanVersion).toBe(3);
      expect((result[0] as any).routePosition).toBe(1);
    });

    it('does not reorder a persisted plan when rider GPS changes', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        lastLatitude: null,
        lastLongitude: 125.608,
      } as RiderProfile);
      const nearShop = makeAssignment(1, 7.065, 125.609);
      const nearInvalidPartialGps = makeAssignment(2, 0.1, 125.608);
      mockActiveAssignmentsQuery([nearInvalidPartialGps, nearShop]);
      dispatchPlanService.getActivePlanForRider.mockResolvedValue({
        id: 500,
        riderId: 10,
        version: 1,
        status: DispatchPlanStatus.ACTIVE,
        stops: [2, 1].map((assignmentId, index) => ({
          assignmentId,
          sequence: index + 1,
          status: DispatchStopStatus.PENDING,
          legGeometry: { type: 'LineString', coordinates: [] },
        })),
      });

      const result = await service.getActiveAssignments(1);

      expect(result.map((assignment) => assignment.id)).toEqual([2, 1]);
    });

    it('exposes assignments as explicitly unplanned before dispatch', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        lastLatitude: null,
        lastLongitude: null,
      } as RiderProfile);
      const missingCoordinates = makeAssignment(1, null, null);
      const routeable = makeAssignment(2, 7.065, 125.609);
      mockActiveAssignmentsQuery([missingCoordinates, routeable]);

      const result = await service.getActiveAssignments(1);
      const views = result as Array<
        DeliveryAssignment & {
          dispatchPlanState: string;
          routePosition: number | null;
        }
      >;

      expect(result.map((assignment) => assignment.id)).toEqual([1, 2]);
      expect(views.map((assignment) => assignment.dispatchPlanState)).toEqual([
        'unplanned',
        'unplanned',
      ]);
      expect(views.map((assignment) => assignment.routePosition)).toEqual([
        null,
        null,
      ]);
    });

    it('keeps newly assigned unplanned work after planned stops', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        lastLatitude: 7.064,
        lastLongitude: 125.608,
      } as RiderProfile);
      const partialCoordinates = makeAssignment(1, null, 125.609);
      const routeable = makeAssignment(2, 7.22, 125.72);
      mockActiveAssignmentsQuery([partialCoordinates, routeable]);
      dispatchPlanService.getActivePlanForRider.mockResolvedValue({
        id: 500,
        riderId: 10,
        version: 1,
        status: DispatchPlanStatus.ACTIVE,
        stops: [
          {
            assignmentId: 2,
            sequence: 1,
            status: DispatchStopStatus.PENDING,
            legGeometry: { type: 'LineString', coordinates: [] },
          },
        ],
      });

      const result = await service.getActiveAssignments(1);

      expect(result.map((assignment) => assignment.id)).toEqual([2, 1]);
      expect((result[1] as any).dispatchPlanState).toBe('unplanned');
    });
  });
});
