import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DeliverySlotsService } from './delivery-slots.service';
import { DeliverySlotTemplate } from './entities/delivery-slot-template.entity';
import { DeliverySlotBooking } from './entities/delivery-slot-booking.entity';

describe('DeliverySlotsService', () => {
  let svc: DeliverySlotsService;
  const templateRepo = { find: jest.fn() };
  const bookingRepo = {
    createQueryBuilder: jest.fn(),
  };
  const dataSource = { transaction: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        DeliverySlotsService,
        {
          provide: getRepositoryToken(DeliverySlotTemplate),
          useValue: templateRepo,
        },
        {
          provide: getRepositoryToken(DeliverySlotBooking),
          useValue: bookingRepo,
        },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    svc = mod.get(DeliverySlotsService);
  });

  describe('getAvailability', () => {
    it('returns template list with booked counts and isFull flags', async () => {
      // 2026-04-30 is a Thursday => dayOfWeek = 4
      templateRepo.find.mockResolvedValue([
        {
          id: 1,
          dayOfWeek: 4,
          startTime: '09:30:00',
          endTime: '11:30:00',
          capacity: 10,
        },
        {
          id: 2,
          dayOfWeek: 4,
          startTime: '14:00:00',
          endTime: '16:00:00',
          capacity: 10,
        },
      ]);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ slotTemplateId: '1', count: '8' }]),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await svc.getAvailability('2026-04-30');

      expect(result).toEqual([
        {
          templateId: 1,
          startTime: '09:30:00',
          endTime: '11:30:00',
          capacity: 10,
          bookedCount: 8,
          isFull: false,
        },
        {
          templateId: 2,
          startTime: '14:00:00',
          endTime: '16:00:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
      ]);
    });
  });
});
