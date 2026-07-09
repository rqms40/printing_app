import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RidersService } from './riders.service';
import { RiderProfile } from './entities/rider-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from './entities/delivery-assignment.entity';
import { LocationGateway } from './location.gateway';
import { OrdersService } from '../orders/orders.service';

describe('RidersService', () => {
  let service: RidersService;
  let profileRepo: jest.Mocked<Partial<Repository<RiderProfile>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let locationGateway: Partial<LocationGateway>;
  let ordersService: jest.Mocked<Pick<OrdersService, 'updateStatus'>>;

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
      createQueryBuilder: jest.fn(),
    };
    locationGateway = {
      broadcastLocation: jest.fn(),
    };
    ordersService = {
      updateStatus: jest.fn(),
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
      ],
    }).compile();

    service = module.get(RidersService);
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
      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        1,
        'rider_assigned',
      );
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
      expect(ordersService.updateStatus).toHaveBeenCalledWith(1, 'delivered');
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
      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        1,
        'ready_for_dispatch',
        { assignedRiderId: null },
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
      expect(ordersService.updateStatus).toHaveBeenLastCalledWith(
        1,
        'on_the_way',
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
