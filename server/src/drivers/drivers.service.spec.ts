import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { DriverProfile } from './entities/driver-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from './entities/delivery-assignment.entity';
import { Order } from '../orders/entities/order.entity';
import { LocationGateway } from './location.gateway';

describe('DriversService', () => {
  let service: DriversService;
  let profileRepo: jest.Mocked<Partial<Repository<DriverProfile>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let orderRepo: jest.Mocked<Partial<Repository<Order>>>;
  let locationGateway: Partial<LocationGateway>;

  const mockProfile = {
    id: 10,
    userId: 1,
    isAvailable: true,
    lastLatitude: 14.5,
    lastLongitude: 121.0,
    lastLocationUpdate: new Date(),
  } as DriverProfile;

  const mockAssignment = {
    id: 100,
    orderId: 1,
    driverId: 10,
    status: DeliveryStatus.ASSIGNED,
    assignedAt: new Date(),
  } as DeliveryAssignment;

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
    orderRepo = {
      findOne: jest.fn(),
    };
    locationGateway = {
      broadcastLocation: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: getRepositoryToken(DriverProfile), useValue: profileRepo },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: assignmentRepo,
        },
        { provide: getRepositoryToken(Order), useValue: orderRepo },
        { provide: LocationGateway, useValue: locationGateway },
      ],
    }).compile();

    service = module.get(DriversService);
  });

  describe('getProfile', () => {
    it('should return driver profile', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);

      const result = await service.getProfile(1);

      expect(profileRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 1 },
      });
      expect(result).toEqual(mockProfile);
    });

    it('should throw NotFoundException if profile not found', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('setAvailability', () => {
    it('should toggle driver to online', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        isAvailable: false,
      } as DriverProfile);
      profileRepo.save.mockImplementation(async (p) => p as DriverProfile);

      const result = await service.setAvailability(1, true);

      expect(result.isAvailable).toBe(true);
      expect(profileRepo.save).toHaveBeenCalled();
    });

    it('should toggle driver to offline', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...mockProfile,
        isAvailable: true,
      } as DriverProfile);
      profileRepo.save.mockImplementation(async (p) => p as DriverProfile);

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
      const delivered = await service.updateDeliveryStatus(
        1,
        100,
        DeliveryStatus.DELIVERED,
      );
      expect(delivered.status).toBe(DeliveryStatus.DELIVERED);
      expect(delivered.deliveredAt).toBeDefined();
    });

    it('should throw NotFoundException if assignment not found', async () => {
      profileRepo.findOne.mockResolvedValue(mockProfile);
      assignmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateDeliveryStatus(1, 999, DeliveryStatus.ACCEPTED),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
