import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  hashDeliveryOtp,
  RidersService,
  riderDeliveryFeeMinor,
} from './riders.service';
import { RiderProfile } from './entities/rider-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from './entities/delivery-assignment.entity';
import { RiderPayout } from './entities/rider-payout.entity';
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
import { AuditService } from '../audit/audit.service';
import { QualityService } from '../quality/quality.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from '../matching/entities/supplier-assignment.entity';
import { DeliveryDestination } from '../orders/entities/delivery-destination.entity';

describe('RidersService', () => {
  let service: RidersService;
  let profileRepo: jest.Mocked<Partial<Repository<RiderProfile>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let orderRepo: jest.Mocked<Partial<Repository<Order>>>;
  let batchRepo: jest.Mocked<Partial<Repository<BatchOrder>>>;
  let historyRepo: jest.Mocked<Partial<Repository<OrderStatusHistory>>>;
  let userRepo: jest.Mocked<Partial<Repository<User>>>;
  let conversationRepo: jest.Mocked<Partial<Repository<Conversation>>>;
  let supplierAssignmentRepo: jest.Mocked<Partial<Repository<SupplierAssignment>>>;
  let destinationRepo: jest.Mocked<Partial<Repository<DeliveryDestination>>>;
  let dataSource: Partial<DataSource>;
  let locationGateway: Partial<LocationGateway>;
  let ordersGateway: {
    notifyDeliveryQueueUpdated: jest.Mock;
    notifyRiderAssignment: jest.Mock;
    notifyRiderDispatchPlanUpdated: jest.Mock;
  };
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
    refreshMarketplaceOriginIfStale: jest.Mock;
  };
  let auditService: { recordOrderStatusTransition: jest.Mock };
  let notificationsService: { createForAllAdmins: jest.Mock };
  const validSignatureProof = JSON.stringify({
    format: 'gridgo-signature-v1',
    points: [
      [1, 1],
      [2, 2],
    ],
  });
  const TEST_OTP = '123456';
  const TEST_OTP_HASH = hashDeliveryOtp(TEST_OTP);
  const WRONG_OTP = '000000';

  const mockProfile = {
    id: 10,
    userId: 1,
    isAvailable: true,
    verificationStatus: 'verified' as any,
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
    pickupOtpCode: TEST_OTP,
    pickupOtpHash: TEST_OTP_HASH,
    pickupOtpVerifiedAt: null,
    deliveryOtpCode: TEST_OTP,
    deliveryOtpHash: TEST_OTP_HASH,
    deliveryOtpVerifiedAt: null,
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
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn(),
      create: jest.fn((value) => value as DeliveryAssignment),
      createQueryBuilder: jest.fn(),
    };
    orderRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn().mockResolvedValue({
        id: 1,
        orderId: 'ORD-1',
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
    supplierAssignmentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
    };
    destinationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
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
            if (entity?.name === 'SupplierAssignment')
              return supplierAssignmentRepo;
            if (entity?.name === 'DeliveryDestination') return destinationRepo;
            throw new Error(`Unexpected repository ${entity?.name}`);
          },
        } as unknown as EntityManager),
    );
    dataSource = {
      getRepository: jest.fn((entity: { name?: string }) => {
        if (entity?.name === 'Order') return orderRepo as Repository<Order>;
        if (entity?.name === 'SupplierAssignment')
          return supplierAssignmentRepo as Repository<SupplierAssignment>;
        if (entity?.name === 'SupplierProfile')
          return { update: jest.fn() };
        throw new Error(`Unexpected repository ${entity?.name}`);
      }) as DataSource['getRepository'],
      transaction: transaction as unknown as DataSource['transaction'],
    };
    locationGateway = {
      broadcastLocation: jest.fn(),
    };
    ordersGateway = {
      notifyDeliveryQueueUpdated: jest.fn(),
      notifyRiderAssignment: jest.fn(),
      notifyRiderDispatchPlanUpdated: jest.fn(),
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
      refreshMarketplaceOriginIfStale: jest.fn().mockResolvedValue(null),
    };
    auditService = {
      recordOrderStatusTransition: jest.fn().mockResolvedValue({ id: 1 }),
    };
    notificationsService = {
      createForAllAdmins: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        RidersService,
        { provide: getRepositoryToken(RiderProfile), useValue: profileRepo },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: assignmentRepo,
        },
        {
          provide: getRepositoryToken(RiderPayout),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn((x) => x) },
        },
        { provide: LocationGateway, useValue: locationGateway },
        { provide: OrdersGateway, useValue: ordersGateway },
        { provide: OrdersService, useValue: ordersService },
        { provide: FilesService, useValue: filesService },
        { provide: ChatGateway, useValue: chatGateway },
        { provide: DataSource, useValue: dataSource },
        { provide: DispatchPlanService, useValue: dispatchPlanService },
        { provide: AuditService, useValue: auditService },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: QualityService,
          useValue: {
            recordPickupQaSubmission: jest.fn().mockResolvedValue({
              checklistResults: {},
              submission: { id: 1 },
            }),
          },
        },
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
        orderStatus: OrderStatus.PRODUCTION,
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
          deliveryOption: 'delivery',
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

      expect(assignmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: readyOrder.id,
          riderId: rider.id,
          status: DeliveryStatus.ASSIGNED,
          isCurrent: true,
          pickupOtpCode: expect.stringMatching(/^\d{6}$/),
          pickupOtpHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          deliveryOtpCode: expect.stringMatching(/^\d{6}$/),
          deliveryOtpHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      );
      // Pickup and delivery share one customer-verification OTP.
      const created = assignmentRepo.create.mock.calls[0][0] as {
        pickupOtpCode: string;
        deliveryOtpCode: string;
        pickupOtpHash: string;
        deliveryOtpHash: string;
      };
      expect(created.deliveryOtpCode).toBe(created.pickupOtpCode);
      expect(created.deliveryOtpHash).toBe(created.pickupOtpHash);
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
      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledWith(
        {
          orderId: readyOrder.id,
          fromStatus: OrderStatus.READY_FOR_DISPATCH,
          toStatus: OrderStatus.RIDER_ASSIGNED,
          actorUserId: 7,
          actorRole: UserRole.OPS_ADMIN,
          reason: `Admin assigned rider ${rider.id}`,
        },
        expect.anything(),
      );
      expect(
        auditService.recordOrderStatusTransition.mock.invocationCallOrder[0],
      ).toBeGreaterThan(historyRepo.insert.mock.invocationCallOrder[0]);
      expect(result).toMatchObject({
        assignment: savedAssignment,
        riderProfile: rider,
        order: { orderStatus: OrderStatus.RIDER_ASSIGNED },
      });
      expect(dispatchPlanService.createPlan).not.toHaveBeenCalled();
    });

    it('rejects marketplace assign when the supplier has no shop pin', async () => {
      const readyOrder = {
        id: 1,
          deliveryOption: 'delivery',
        orderId: 'ORD-1',
        batchOrderId: null,
        destinationId: 9,
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      } as Order;
      const rider = {
        ...mockProfile,
        user: { id: 21, role: UserRole.RIDER, isActive: true } as User,
      } as RiderProfile;
      orderRepo.findOneOrFail.mockResolvedValue(readyOrder);
      assignmentRepo.findOne.mockResolvedValue(null);
      profileRepo.findOne.mockResolvedValue(rider);
      supplierAssignmentRepo.findOne!.mockResolvedValue({
        orderId: 1,
        supplierId: 88,
        decision: SupplierAssignmentDecision.ACCEPTED,
        supplier: { id: 88, latitude: null, longitude: null },
      } as SupplierAssignment);

      await expect(service.assignOrderToRider(1, rider.id, 7)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'supplier_location_required',
        }),
      });
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects marketplace assign when the rider already has an active job', async () => {
      const readyOrder = {
        id: 1,
          deliveryOption: 'delivery',
        orderId: 'ORD-1',
        batchOrderId: null,
        destinationId: 9,
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      } as Order;
      const rider = {
        ...mockProfile,
        user: { id: 21, role: UserRole.RIDER, isActive: true } as User,
      } as RiderProfile;
      orderRepo.findOneOrFail.mockResolvedValue(readyOrder);
      assignmentRepo.findOne.mockResolvedValue(null);
      profileRepo.findOne.mockResolvedValue(rider);
      supplierAssignmentRepo.findOne!.mockResolvedValue({
        orderId: 1,
        supplierId: 88,
        decision: SupplierAssignmentDecision.ACCEPTED,
        supplier: { id: 88, latitude: 7.0505, longitude: 125.5889 },
      } as SupplierAssignment);
      destinationRepo.findOne!.mockResolvedValue({
        id: 9,
        latitude: 7.074,
        longitude: 125.6079,
      } as DeliveryDestination);
      assignmentRepo.count!.mockResolvedValue(1);

      await expect(service.assignOrderToRider(1, rider.id, 7)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('auto-creates a two-stop plan after marketplace rider assignment', async () => {
      const readyOrder = {
        id: 1,
          deliveryOption: 'delivery',
        orderId: 'ORD-1',
        batchOrderId: null,
        destinationId: 9,
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      } as Order;
      const rider = {
        ...mockProfile,
        user: { id: 21, role: UserRole.RIDER, isActive: true } as User,
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
      assignmentRepo.count!.mockResolvedValue(0);
      supplierAssignmentRepo.findOne!.mockResolvedValue({
        orderId: 1,
        supplierId: 88,
        decision: SupplierAssignmentDecision.ACCEPTED,
        supplier: { id: 88, latitude: 7.0505, longitude: 125.5889 },
      } as SupplierAssignment);
      destinationRepo.findOne!.mockResolvedValue({
        id: 9,
        latitude: 7.074,
        longitude: 125.6079,
      } as DeliveryDestination);
      ordersService.publishStatusUpdate.mockResolvedValue({
        ...readyOrder,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order);
      dispatchPlanService.createPlan.mockResolvedValue({ id: 501 });

      await service.assignOrderToRider(1, rider.id, 7);

      expect(dispatchPlanService.createPlan).toHaveBeenCalledWith(rider.id, [
        savedAssignment.id,
      ]);
    });

    it('records super_admin actor role on assign when provided from JWT', async () => {
      const readyOrder = {
        id: 1,
          deliveryOption: 'delivery',
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
      orderRepo.findOneOrFail.mockResolvedValue(readyOrder);
      orderRepo.update.mockResolvedValue({ affected: 1 } as never);
      assignmentRepo.findOne.mockResolvedValue(null);
      profileRepo.findOne.mockResolvedValue(rider);
      assignmentRepo.save.mockResolvedValue({
        id: 301,
        orderId: readyOrder.id,
        riderId: rider.id,
        status: DeliveryStatus.ASSIGNED,
        isCurrent: true,
      } as DeliveryAssignment);
      ordersService.publishStatusUpdate.mockResolvedValue({
        ...readyOrder,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order);

      await service.assignOrderToRider(
        readyOrder.id,
        rider.id,
        7,
        UserRole.SUPER_ADMIN,
      );

      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          actorRole: UserRole.SUPER_ADMIN,
          actorUserId: 7,
          toStatus: OrderStatus.RIDER_ASSIGNED,
        }),
        expect.anything(),
      );
    });

    it('returns the committed assignment when post-commit customer publication fails', async () => {
      const readyOrder = {
        id: 1,
          deliveryOption: 'delivery',
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

    it('still returns committed assignment data when publication and reload both fail', async () => {
      const readyOrder = {
        id: 1,
          deliveryOption: 'delivery',
        orderId: 'ORD-1',
        batchOrderId: null,
        deliveryOption: 'delivery',
        assignedRiderId: null,
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      } as Order;
      const rider = {
        ...mockProfile,
        user: {
          id: mockProfile.userId,
          role: UserRole.RIDER,
          isActive: true,
        } as User,
      } as RiderProfile;
      const savedAssignment = {
        ...mockAssignment,
        isCurrent: true,
      } as DeliveryAssignment;
      orderRepo.findOneOrFail
        .mockResolvedValueOnce(readyOrder)
        .mockResolvedValueOnce(readyOrder)
        .mockRejectedValueOnce(new Error('Reload unavailable'));
      orderRepo.update.mockResolvedValue({ affected: 1 } as never);
      assignmentRepo.findOne.mockResolvedValue(null);
      assignmentRepo.save.mockResolvedValue(savedAssignment);
      profileRepo.findOne.mockResolvedValue(rider);
      ordersService.publishStatusUpdate.mockRejectedValue(
        new Error('Customer publication failed'),
      );

      const result = await service.assignOrderToRider(
        readyOrder.id,
        rider.id,
        7,
      );
      expect(result).toEqual({
        assignment: expect.objectContaining({
          id: savedAssignment.id,
          orderId: savedAssignment.orderId,
          riderId: savedAssignment.riderId,
          status: DeliveryStatus.ASSIGNED,
          isCurrent: true,
        }),
        riderProfile: rider,
        order: {
          ...readyOrder,
          assignedRiderId: rider.userId,
          orderStatus: OrderStatus.RIDER_ASSIGNED,
        },
      });
      expect(result.assignment).not.toHaveProperty('pickupOtpCode');
      expect(result.assignment).not.toHaveProperty('pickupOtpHash');
      expect(result.assignment).not.toHaveProperty('deliveryOtpCode');
      expect(result.assignment).not.toHaveProperty('deliveryOtpHash');
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
          deliveryOption: 'delivery',
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
      ['non-rider', true, true, UserRole.CLIENT],
    ])(
      'rejects an %s rider profile',
      async (_label, isAvailable, isActive, role) => {
        const readyOrder = {
          id: 1,
          deliveryOption: 'delivery',
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
          deliveryOption: 'delivery',
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
      ['wrong role', true, true, UserRole.CLIENT, false],
    ])(
      'projects %s assignment eligibility from server-owned identity state',
      async (_label, isAvailable, isActive, role, expected) => {
        profileRepo.find.mockResolvedValue([
          {
            ...mockProfile,
            isAvailable,
            verificationStatus: 'verified' as any,
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

    it('requires verified status for assignment eligibility', async () => {
      profileRepo.find.mockResolvedValue([
        {
          ...mockProfile,
          isAvailable: true,
          verificationStatus: 'pending' as any,
          user: {
            id: mockProfile.userId,
            fullName: 'Juan Rider',
            email: 'juan@example.test',
            isActive: true,
            role: UserRole.RIDER,
          } as User,
        } as RiderProfile,
      ]);

      await expect(service.getAllRidersWithUser()).resolves.toEqual([
        expect.objectContaining({
          assignment_eligible: false,
          verification_status: 'pending',
        }),
      ]);
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
      filesService.resolveDeliveryProofFile.mockResolvedValue({
        id: 55,
        objectKey: 'uploads/proof_of_delivery/pickup-55.jpg',
      });

      const result = await service.updateDeliveryStatus(
        mockProfile.userId,
        acceptedAssignment.id,
        DeliveryStatus.PICKED_UP,
        undefined,
        { type: 'photo', fileId: 55 } as any,
        TEST_OTP,
        {
          quantity_match: true,
          specification_match: true,
          visible_defects: true,
          packaging_integrity: true,
          documentation: true,
          supplier_sign_off: true,
        },
      );

      expect(result.status).toBe(DeliveryStatus.PICKED_UP);
      expect(result.pickupOtpCode).toBeUndefined();
      expect(result.pickupOtpHash).toBeUndefined();
      expect(result.deliveryOtpCode).toBeUndefined();
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
      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledWith(
        {
          orderId: assignedOrder.id,
          fromStatus: OrderStatus.RIDER_ASSIGNED,
          toStatus: OrderStatus.PICKED_UP,
          actorUserId: mockProfile.userId,
          actorRole: UserRole.RIDER,
          reason: 'Rider updated delivery to picked_up',
        },
        expect.anything(),
      );
      expect(
        auditService.recordOrderStatusTransition.mock.invocationCallOrder[0],
      ).toBeGreaterThan(historyRepo.insert.mock.invocationCallOrder[0]);
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
      ordersGateway.notifyRiderAssignment.mockImplementation(() => {
        throw new Error('Rider socket unavailable');
      });
      filesService.resolveDeliveryProofFile.mockResolvedValue({
        id: 55,
        objectKey: 'uploads/proof_of_delivery/pickup-55.jpg',
      });

      await expect(
        service.updateDeliveryStatus(
          mockProfile.userId,
          acceptedAssignment.id,
          DeliveryStatus.PICKED_UP,
          undefined,
          { type: 'photo', fileId: 55 } as any,
          TEST_OTP,
          {
            quantity_match: true,
            specification_match: true,
            visible_defects: true,
            packaging_integrity: true,
            documentation: true,
            supplier_sign_off: true,
          },
        ),
      ).resolves.toMatchObject({ status: DeliveryStatus.PICKED_UP });

      expect(historyRepo.insert).toHaveBeenCalledTimes(1);
      expect(ordersGateway.notifyRiderAssignment).toHaveBeenCalledTimes(1);
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
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
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
          { type: 'signature', signatureData: validSignatureProof } as any,
          TEST_OTP,
        ),
      ).rejects.toThrow('survey insert failed');

      expect(ordersService.publishStatusUpdate).not.toHaveBeenCalled();
      expect(locationGateway.broadcastLocation).not.toHaveBeenCalled();
      expect(ordersGateway.notifyDeliveryQueueUpdated).not.toHaveBeenCalled();
      expect(ordersGateway.notifyRiderAssignment).not.toHaveBeenCalled();
      expect(
        ordersGateway.notifyRiderDispatchPlanUpdated,
      ).not.toHaveBeenCalled();
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
      dispatchPlanService.skipStopIfPlanned.mockResolvedValueOnce({
        planId: 500,
        riderId: mockProfile.id,
        planVersion: 4,
        planStatus: DispatchPlanStatus.COMPLETED,
        assignmentId: assignedAssignment.id,
        stopStatus: DispatchStopStatus.SKIPPED,
      });

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
      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledWith(
        {
          orderId: assignedOrder.id,
          fromStatus: OrderStatus.RIDER_ASSIGNED,
          toStatus: OrderStatus.READY_FOR_DISPATCH,
          actorUserId: mockProfile.userId,
          actorRole: UserRole.RIDER,
          reason: 'Rider declined assignment: Too far',
        },
        expect.anything(),
      );
      expect(ordersGateway.notifyRiderAssignment).toHaveBeenCalledWith(
        mockProfile.userId,
        {
          assignmentId: assignedAssignment.id,
          orderId: assignedAssignment.orderId,
          orderRef: assignedOrder.orderId,
          status: DeliveryStatus.DECLINED,
          change: 'unassigned',
        },
      );
      expect(ordersGateway.notifyRiderDispatchPlanUpdated).toHaveBeenCalledWith(
        mockProfile.userId,
        {
          riderProfileId: mockProfile.id,
          planId: 500,
          planVersion: 4,
          change: 'completed',
          assignmentId: assignedAssignment.id,
          stopStatus: DispatchStopStatus.SKIPPED,
          planStatus: DispatchPlanStatus.COMPLETED,
        },
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
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.DELIVERED,
          undefined,
          undefined,
          TEST_OTP,
        ),
      ).rejects.toThrow('Proof of delivery is required');
      expect(assignmentRepo.save).not.toHaveBeenCalled();
      expect(ordersService.updateStatus).not.toHaveBeenCalled();
    });

    it('rejects delivered when OTP is wrong', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.DELIVERED,
          undefined,
          { type: 'signature', signatureData: validSignatureProof } as any,
          WRONG_OTP,
        ),
      ).rejects.toThrow('Invalid OTP');
      expect(assignmentRepo.save).not.toHaveBeenCalled();
      expect(ordersService.completeDelivery).not.toHaveBeenCalled();
    });

    it('rejects delivered when OTP is missing', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.DELIVERED,
          undefined,
          { type: 'signature', signatureData: validSignatureProof } as any,
        ),
      ).rejects.toThrow('Delivery OTP is required');
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects double-complete after delivery', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.DELIVERED,
        deliveryOtpVerifiedAt: new Date(),
      } as DeliveryAssignment);

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.DELIVERED,
          undefined,
          { type: 'signature', signatureData: validSignatureProof } as any,
          TEST_OTP,
        ),
      ).rejects.toThrow(/Cannot transition from 'delivered'/);
      expect(assignmentRepo.save).not.toHaveBeenCalled();
      expect(ordersService.completeDelivery).not.toHaveBeenCalled();
    });

    it('rejects pickup with wrong OTP', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ACCEPTED,
      } as DeliveryAssignment);
      filesService.resolveDeliveryProofFile.mockResolvedValue({
        id: 55,
        objectKey: 'uploads/proof_of_delivery/pickup-55.jpg',
      });

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.PICKED_UP,
          undefined,
          { type: 'photo', fileId: 55 } as any,
          WRONG_OTP,
        ),
      ).rejects.toThrow('Invalid OTP');
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects pickup without photo proof', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ACCEPTED,
      } as DeliveryAssignment);

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.PICKED_UP,
          undefined,
          { type: 'signature', signatureData: validSignatureProof } as any,
          TEST_OTP,
          {
            quantity_match: true,
            specification_match: true,
            visible_defects: true,
            packaging_integrity: true,
            documentation: true,
            supplier_sign_off: true,
          },
        ),
      ).rejects.toThrow('Photo proof is required');
      expect(assignmentRepo.save).not.toHaveBeenCalled();
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
        orderId: 'ORD-1',
        batchOrderId: null,
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      } as Order);
      const surveyRequirement = { id: 70 };
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          batchOrderId: null,
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        },
        surveyRequirement,
      });
      filesService.resolveDeliveryProofFile.mockResolvedValue({
        id: 55,
        objectKey: 'uploads/proof_of_delivery/server-55.jpg',
      });
      dispatchPlanService.advanceStop.mockResolvedValueOnce({
        planId: 500,
        riderId: mockProfile.id,
        planVersion: 4,
        planStatus: DispatchPlanStatus.COMPLETED,
        assignmentId: mockAssignment.id,
        stopStatus: DispatchStopStatus.COMPLETED,
      });
      ordersGateway.notifyRiderDispatchPlanUpdated.mockImplementationOnce(
        () => {
          throw new Error('Rider plan socket unavailable');
        },
      );

      const result = await (service.updateDeliveryStatus as any)(
        1,
        100,
        DeliveryStatus.DELIVERED,
        undefined,
        { type: 'photo', fileId: 55, objectKey: 'spoofed/client-key.jpg' },
        TEST_OTP,
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
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        }),
        1,
        OrderStatus.DELIVERED,
        surveyRequirement,
      );
      expect(ordersGateway.notifyRiderDispatchPlanUpdated).toHaveBeenCalledWith(
        mockProfile.userId,
        {
          riderProfileId: mockProfile.id,
          planId: 500,
          planVersion: 4,
          change: 'completed',
          assignmentId: mockAssignment.id,
          stopStatus: DispatchStopStatus.COMPLETED,
          planStatus: DispatchPlanStatus.COMPLETED,
        },
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
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      } as Order);
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          orderId: 'VEN-1',
          userId: 21,
          batchOrderId: null,
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
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
      dispatchPlanService.advanceStop.mockResolvedValueOnce({
        planId: 500,
        riderId: mockProfile.id,
        planVersion: 4,
        planStatus: DispatchPlanStatus.ACTIVE,
        assignmentId: venAssignment.id,
        stopStatus: DispatchStopStatus.COMPLETED,
      });

      await service.updateDeliveryStatus(
        mockProfile.userId,
        venAssignment.id,
        DeliveryStatus.DELIVERED,
        undefined,
        { type: 'signature', signatureData: validSignatureProof } as any,
        TEST_OTP,
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
      expect(ordersGateway.notifyRiderDispatchPlanUpdated).toHaveBeenCalledWith(
        mockProfile.userId,
        {
          riderProfileId: mockProfile.id,
          planId: 500,
          planVersion: 4,
          change: 'stopCompleted',
          assignmentId: venAssignment.id,
          stopStatus: DispatchStopStatus.COMPLETED,
          planStatus: DispatchPlanStatus.ACTIVE,
        },
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
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      } as Order);
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          orderId: 'VEN-1',
          userId: 21,
          batchOrderId: null,
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
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
          { type: 'signature', signatureData: validSignatureProof } as any,
          TEST_OTP,
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
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        } as Order);
        const previous = {
          id: 1,
          orderId: 'VEN-1',
          userId: 21,
          batchOrderId: null,
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
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
            { type: 'signature', signatureData: validSignatureProof } as any,
            TEST_OTP,
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
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      } as Order);
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          batchOrderId: null,
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
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
          TEST_OTP,
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
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      } as Order);
      ordersService.completeDelivery.mockResolvedValue({
        previous: {
          id: 1,
          batchOrderId: null,
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        },
        surveyRequirement: null,
      });

      const result = await (service.updateDeliveryStatus as any)(
        1,
        100,
        DeliveryStatus.DELIVERED,
        undefined,
        { type: 'signature', signatureData: validSignatureProof },
        TEST_OTP,
      );

      expect(result.status).toBe(DeliveryStatus.DELIVERED);
      expect(result.deliveredAt).toBeDefined();
      expect(result.proofType).toBe('signature');
      expect(result.proofSignatureData).toBe(validSignatureProof);
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
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
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
          TEST_OTP,
        ),
      ).rejects.toThrow('Signature proof is too large');

      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      'x',
      JSON.stringify({
        format: 'legacy-signature',
        points: [
          [1, 1],
          [2, 2],
        ],
      }),
      JSON.stringify({ format: 'gridgo-signature-v1', points: [[1, 1]] }),
      JSON.stringify({
        format: 'gridgo-signature-v1',
        points: [[1, 1], null, [2, 2]],
      }),
      JSON.stringify({
        format: 'gridgo-signature-v1',
        points: [
          [1, 1],
          [1, 1],
        ],
      }),
    ])(
      'rejects malformed or empty signature proof %#',
      async (signatureData) => {
        await expect(
          (service as any).validateProofOfDelivery(
            {
              type: 'signature',
              signatureData,
            },
            mockProfile.userId,
            {
              requirePhoto: false,
              allowOptionalSignatureWithPhoto: true,
            },
          ),
        ).rejects.toThrow('Invalid signature proof');
      },
    );

    it('rejects signature proof that also includes a file id', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      } as Order);

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.DELIVERED,
          undefined,
          {
            type: 'signature',
            signatureData: validSignatureProof,
            fileId: 55,
          } as any,
          TEST_OTP,
        ),
      ).rejects.toThrow('Unsupported mixed proof payload');

      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects invalid optional signature attached to photo proof', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment);
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      } as Order);
      filesService.resolveDeliveryProofFile.mockResolvedValue({
        id: 55,
        objectKey: 'uploads/proof_of_delivery/server-55.jpg',
      });

      await expect(
        service.updateDeliveryStatus(
          1,
          100,
          DeliveryStatus.DELIVERED,
          undefined,
          {
            type: 'photo',
            fileId: 55,
            signatureData: 'not-json-signature',
          } as any,
          TEST_OTP,
        ),
      ).rejects.toThrow('Invalid signature proof');

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

    it('records failed delivery with evidence, does not deliver, notifies ops', async () => {
      const arrived = {
        ...mockAssignment,
        status: DeliveryStatus.ARRIVED,
      } as DeliveryAssignment;
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue(arrived);
      assignmentRepo.save.mockImplementation(
        async (a) => a as DeliveryAssignment,
      );
      orderRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        orderId: 'ORD-FAIL-1',
        batchOrderId: null,
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      } as Order);
      filesService.resolveDeliveryProofFile.mockResolvedValue({
        id: 88,
        objectKey: 'proofs/fail.jpg',
      });
      dispatchPlanService.skipStopIfPlanned.mockResolvedValue({
        planId: 1,
        riderId: 10,
        planVersion: 1,
        planStatus: DispatchPlanStatus.ACTIVE,
        assignmentId: 100,
        stopStatus: DispatchStopStatus.SKIPPED,
      });

      const result = await (service.updateDeliveryStatus as any)(
        1,
        100,
        DeliveryStatus.FAILED,
        'Customer unreachable',
        { type: 'photo', fileId: 88 },
      );

      expect(result.status).toBe(DeliveryStatus.FAILED);
      expect(result.isCurrent).toBe(false);
      expect(result.proofFileId).toBe(88);
      expect(result.failedAt).toBeInstanceOf(Date);
      expect(orderRepo.update).toHaveBeenCalledWith(
        { id: 1, orderStatus: OrderStatus.OUT_FOR_DELIVERY },
        expect.objectContaining({
          assignedRiderId: null,
          orderStatus: OrderStatus.DELIVERY_FAILED,
        }),
      );
      expect(ordersService.completeDelivery).not.toHaveBeenCalled();
      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'failed_delivery',
          orderRef: 'ORD-FAIL-1',
          metadata: expect.objectContaining({
            redeliveryFeeRequired: true,
            redeliveryFeeApproval: 'ops_stub',
          }),
        }),
      );
    });

    it('rejects failed delivery without evidence reason or photo', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        status: DeliveryStatus.ON_THE_WAY,
      } as DeliveryAssignment);

      await expect(
        service.updateDeliveryStatus(1, 100, DeliveryStatus.FAILED, ''),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'failed_delivery_reason_required',
        }),
      });
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
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.OUT_FOR_DELIVERY,
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

      // ACCEPTED -> PICKED_UP (OTP + photo)
      const acceptedAssignment = {
        ...mockAssignment,
        status: DeliveryStatus.ACCEPTED,
      } as DeliveryAssignment;
      assignmentRepo.findOne.mockResolvedValue(acceptedAssignment);
      filesService.resolveDeliveryProofFile.mockResolvedValue({
        id: 55,
        objectKey: 'uploads/proof_of_delivery/pickup-55.jpg',
      });
      const pickedUp = await service.updateDeliveryStatus(
        1,
        100,
        DeliveryStatus.PICKED_UP,
        undefined,
        { type: 'photo', fileId: 55 } as any,
        TEST_OTP,
        {
          quantity_match: true,
          specification_match: true,
          visible_defects: true,
          packaging_integrity: true,
          documentation: true,
          supplier_sign_off: true,
        },
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
        OrderStatus.OUT_FOR_DELIVERY,
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
          orderStatus: OrderStatus.OUT_FOR_DELIVERY,
        },
        surveyRequirement: null,
      });
      const delivered = await (service.updateDeliveryStatus as any)(
        1,
        100,
        DeliveryStatus.DELIVERED,
        undefined,
        { type: 'signature', signatureData: validSignatureProof },
        TEST_OTP,
      );
      expect(delivered.status).toBe(DeliveryStatus.DELIVERED);
      expect(delivered.deliveredAt).toBeDefined();
      expect(ordersGateway.notifyRiderAssignment).toHaveBeenCalledTimes(5);
      expect(
        ordersGateway.notifyRiderAssignment.mock.calls.map(
          ([, payload]) => (payload as { status: DeliveryStatus }).status,
        ),
      ).toEqual([
        DeliveryStatus.ACCEPTED,
        DeliveryStatus.PICKED_UP,
        DeliveryStatus.ON_THE_WAY,
        DeliveryStatus.ARRIVED,
        DeliveryStatus.DELIVERED,
      ]);
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
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
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

  describe('dispatch plan realtime publication', () => {
    const persistedPlan = { id: 501, riderId: 10, version: 4 } as any;

    beforeEach(() => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        id: 10,
        userId: 70,
      } as RiderProfile);
    });

    it('signals the rider after creating a persisted dispatch plan', async () => {
      dispatchPlanService.createPlan.mockResolvedValue(persistedPlan);

      await expect(service.createDispatchPlan(10, [101, 102])).resolves.toBe(
        persistedPlan,
      );

      expect(ordersGateway.notifyRiderDispatchPlanUpdated).toHaveBeenCalledWith(
        70,
        {
          riderProfileId: 10,
          planId: 501,
          planVersion: 4,
          change: 'created',
        },
      );
    });

    it('signals the rider after re-optimizing a persisted dispatch plan', async () => {
      dispatchPlanService.reoptimizePlan.mockResolvedValue(persistedPlan);

      await expect(
        service.reoptimizeDispatchPlan(10, [102, 101]),
      ).resolves.toBe(persistedPlan);

      expect(ordersGateway.notifyRiderDispatchPlanUpdated).toHaveBeenCalledWith(
        70,
        {
          riderProfileId: 10,
          planId: 501,
          planVersion: 4,
          change: 'reoptimized',
        },
      );
    });

    it('does not signal when dispatch-plan persistence fails', async () => {
      dispatchPlanService.createPlan.mockRejectedValue(
        new Error('routing persistence failed'),
      );

      await expect(service.createDispatchPlan(10, [101, 102])).rejects.toThrow(
        'routing persistence failed',
      );
      expect(
        ordersGateway.notifyRiderDispatchPlanUpdated,
      ).not.toHaveBeenCalled();
    });

    it('does not roll back a persisted plan when realtime publication fails', async () => {
      dispatchPlanService.createPlan.mockResolvedValue(persistedPlan);
      ordersGateway.notifyRiderDispatchPlanUpdated.mockImplementation(() => {
        throw new Error('socket offline');
      });

      await expect(service.createDispatchPlan(10, [101, 102])).resolves.toBe(
        persistedPlan,
      );
    });
  });

  describe('rider-scoped dispatch plan re-optimization', () => {
    const activePlan = {
      id: 500,
      riderId: 10,
      version: 3,
      status: DispatchPlanStatus.ACTIVE,
      routingDataStale: false,
      stops: [
        {
          assignmentId: 103,
          sequence: 3,
          status: DispatchStopStatus.PENDING,
        },
        {
          assignmentId: 102,
          sequence: 2,
          status: DispatchStopStatus.COMPLETED,
        },
        {
          assignmentId: 101,
          sequence: 1,
          status: DispatchStopStatus.PENDING,
        },
      ],
    };
    const reoptimizedPlan = {
      ...activePlan,
      id: 501,
      version: 4,
    };

    beforeEach(() => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      dispatchPlanService.getActivePlanForRider.mockResolvedValue(activePlan);
      dispatchPlanService.reoptimizePlan.mockResolvedValue(reoptimizedPlan);
    });

    it('re-optimizes only the caller rider profile pending stops', async () => {
      await expect(
        service.reoptimizeOwnDispatchPlan(mockProfile.userId),
      ).resolves.toBe(reoptimizedPlan);

      expect(profileRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { userId: mockProfile.userId },
        relations: ['user'],
      });
      expect(dispatchPlanService.getActivePlanForRider).toHaveBeenCalledWith(
        mockProfile.id,
      );
      expect(dispatchPlanService.reoptimizePlan).toHaveBeenCalledWith(
        mockProfile.id,
        [101, 103],
        activePlan.id,
      );
    });

    it('returns 404 when the caller rider profile has no active plan', async () => {
      dispatchPlanService.getActivePlanForRider.mockResolvedValue(null);

      await expect(
        service.reoptimizeOwnDispatchPlan(mockProfile.userId),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(dispatchPlanService.reoptimizePlan).not.toHaveBeenCalled();
      expect(
        ordersGateway.notifyRiderDispatchPlanUpdated,
      ).not.toHaveBeenCalled();
    });

    it('keeps routing_unavailable and the active plan on routing failure', async () => {
      const preservedPlan = structuredClone(activePlan);
      const routingError = new ServiceUnavailableException({
        code: 'routing_unavailable',
        message: 'Road routing is temporarily unavailable',
        preservedPlan: { ...activePlan, routingDataStale: true },
      });
      dispatchPlanService.reoptimizePlan.mockRejectedValue(routingError);

      const error: unknown = await service
        .reoptimizeOwnDispatchPlan(mockProfile.userId)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      if (!(error instanceof ServiceUnavailableException)) {
        throw new Error('Expected ServiceUnavailableException');
      }
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toEqual(
        expect.objectContaining({
          code: 'routing_unavailable',
          preservedPlan: expect.objectContaining({
            id: activePlan.id,
            version: activePlan.version,
            stops: activePlan.stops,
          }),
        }),
      );
      expect(activePlan).toEqual(preservedPlan);
      expect(
        ordersGateway.notifyRiderDispatchPlanUpdated,
      ).not.toHaveBeenCalled();
    });
  });

  describe('updateLocation active-trip window', () => {
    it('broadcasts the persisted plan version with current-stop location updates', async () => {
      profileRepo.findOne.mockResolvedValue({ ...mockProfile });
      profileRepo.save.mockImplementation(
        async (profile) => profile as RiderProfile,
      );
      assignmentRepo.find = jest.fn().mockResolvedValue([
        {
          ...mockAssignment,
          isCurrent: true,
          status: DeliveryStatus.ON_THE_WAY,
        },
      ]);
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

    it('rejects location pings when no active trip (picked_up / out_for_delivery)', async () => {
      profileRepo.findOne.mockResolvedValue({ ...mockProfile });
      assignmentRepo.find = jest.fn().mockResolvedValue([]);

      await expect(
        service.updateLocation(1, {
          latitude: 7.06405,
          longitude: 125.60795,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'tracking_inactive' }),
      });
      expect(profileRepo.save).not.toHaveBeenCalled();
      expect(locationGateway.broadcastLocation).not.toHaveBeenCalled();
    });

    it('accepts pings at picked_up and broadcasts for the current stop', async () => {
      profileRepo.findOne.mockResolvedValue({ ...mockProfile });
      profileRepo.save.mockImplementation(
        async (profile) => profile as RiderProfile,
      );
      assignmentRepo.find = jest.fn().mockResolvedValue([
        {
          ...mockAssignment,
          isCurrent: true,
          status: DeliveryStatus.PICKED_UP,
        },
      ]);
      dispatchPlanService.getCurrentPendingStopForRider.mockResolvedValue({
        stop: {
          assignmentId: 100,
          sequence: 1,
          status: DispatchStopStatus.PENDING,
        },
        planVersion: 2,
      });
      assignmentRepo.findOne.mockResolvedValue({
        ...mockAssignment,
        isCurrent: true,
        status: DeliveryStatus.PICKED_UP,
      } as DeliveryAssignment);

      await service.updateLocation(1, {
        latitude: 7.07,
        longitude: 125.61,
      });

      expect(locationGateway.broadcastLocation).toHaveBeenCalledWith(
        '100',
        expect.objectContaining({
          assignmentId: '100',
          planVersion: 2,
          latitude: 7.07,
          longitude: 125.61,
        }),
      );
    });

    it('accepts marketplace GPS pings while riding to the supplier', async () => {
      profileRepo.findOne.mockResolvedValue({ ...mockProfile });
      profileRepo.save.mockImplementation(
        async (profile) => profile as RiderProfile,
      );
      assignmentRepo.find = jest.fn().mockResolvedValue([
        {
          ...mockAssignment,
          isCurrent: true,
          status: DeliveryStatus.ASSIGNED,
          orderId: 1,
        },
      ]);
      supplierAssignmentRepo.findOne!.mockResolvedValue({
        orderId: 1,
        decision: SupplierAssignmentDecision.ACCEPTED,
      } as SupplierAssignment);
      dispatchPlanService.getCurrentPendingStopForRider.mockResolvedValue({
        stop: {
          assignmentId: 100,
          sequence: 1,
          status: DispatchStopStatus.PENDING,
        },
        planVersion: 1,
      });

      await service.updateLocation(1, {
        latitude: 7.08,
        longitude: 125.61,
      });

      expect(locationGateway.broadcastLocation).toHaveBeenCalledWith(
        '100',
        expect.objectContaining({
          assignmentId: '100',
          latitude: 7.08,
          longitude: 125.61,
        }),
      );
    });
  });

  describe('getActiveAssignments', () => {
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

  describe('getEarnings', () => {
    it('prefers deliveryFeeMinor over the major-peso column', () => {
      expect(
        riderDeliveryFeeMinor({ deliveryFee: 40, deliveryFeeMinor: '5000' }),
      ).toBe(5000);
      expect(riderDeliveryFeeMinor({ deliveryFee: 25 })).toBe(2500);
      expect(riderDeliveryFeeMinor(null)).toBe(0);
    });

    it('adds each delivered fee into today, week, month, and lifetime totals', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      const now = new Date();
      const earlierThisMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 8, 0, 0),
      );
      const lastMonth = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 8, 0, 0),
      );
      assignmentRepo.find.mockResolvedValue([
        {
          id: 1,
          riderId: 10,
          status: DeliveryStatus.DELIVERED,
          deliveredAt: now,
          updatedAt: now,
          order: { deliveryFee: 0, deliveryFeeMinor: '5000' },
        },
        {
          id: 2,
          riderId: 10,
          status: DeliveryStatus.DELIVERED,
          deliveredAt: earlierThisMonth,
          updatedAt: earlierThisMonth,
          order: { deliveryFee: 25 },
        },
        {
          id: 3,
          riderId: 10,
          status: DeliveryStatus.DELIVERED,
          deliveredAt: lastMonth,
          updatedAt: lastMonth,
          order: { deliveryFee: 40 },
        },
      ] as DeliveryAssignment[]);

      const out = await service.getEarnings(1);

      expect(out.deliveries).toBe(3);
      expect(out.total).toBe(115);
      expect(out.today).toBe(50);
      expect(out.thisMonth).toBeGreaterThanOrEqual(50);
      expect(out.thisMonth).toBeLessThanOrEqual(115);
      expect(out.thisWeek).toBeGreaterThanOrEqual(50);
    });

    it('adds multiple same-day delivery fees together', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      const now = new Date();
      assignmentRepo.find.mockResolvedValue([
        {
          id: 1,
          riderId: 10,
          status: DeliveryStatus.DELIVERED,
          deliveredAt: now,
          updatedAt: now,
          order: { deliveryFee: 50 },
        },
        {
          id: 2,
          riderId: 10,
          status: DeliveryStatus.DELIVERED,
          deliveredAt: now,
          updatedAt: now,
          order: { deliveryFeeMinor: '3000' },
        },
      ] as DeliveryAssignment[]);

      const out = await service.getEarnings(1);

      expect(out.deliveries).toBe(2);
      expect(out.today).toBe(80);
      expect(out.total).toBe(80);
    });

    it('returns zeros when the rider has no completed deliveries', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.find.mockResolvedValue([]);

      await expect(service.getEarnings(1)).resolves.toEqual({
        total: 0,
        deliveries: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
      });
    });
  });
});
