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

  describe('bookSlot', () => {
    it('throws SlotFullException when capacity reached', async () => {
      const txManager = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          dayOfWeek: 4,
          capacity: 10,
        }),
        createQueryBuilder: jest.fn(() => ({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(10),
        })),
      };
      await expect(
        svc.bookSlot(txManager as any, {
          slotTemplateId: 1,
          date: '2026-04-30',
          batchOrderId: 99,
          priority: false,
        }),
      ).rejects.toThrow('Slot is full');
    });

    it('inserts a booking when capacity not reached', async () => {
      const inserted = {
        id: 7,
        slotTemplateId: 1,
        date: '2026-04-30',
        batchOrderId: 99,
        priority: false,
      };
      const txManager = {
        findOne: jest.fn().mockResolvedValue({
          id: 1,
          dayOfWeek: 4,
          capacity: 10,
        }),
        createQueryBuilder: jest.fn(() => ({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(8),
        })),
        create: jest.fn().mockReturnValue(inserted),
        save: jest.fn().mockResolvedValue(inserted),
      };

      const result = await svc.bookSlot(txManager as any, {
        slotTemplateId: 1,
        date: '2026-04-30',
        batchOrderId: 99,
        priority: false,
      });

      expect(result).toEqual(inserted);
      expect(txManager.create).toHaveBeenCalled();
    });
  });

  describe('releaseSlot', () => {
    it('throws CancellationClosedException past cutoff', async () => {
      const past = '2020-01-01';
      const tx = {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          slotTemplateId: 1,
          date: past,
          slotTemplate: { startTime: '09:30:00' },
        }),
      };
      await expect(svc.releaseSlot(tx as any, 7)).rejects.toThrow(
        'Slot is in progress, cancellation closed',
      );
    });

    it('removes booking before cutoff', async () => {
      const future = new Date(Date.now() + 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const tx = {
        findOne: jest.fn().mockResolvedValue({
          id: 7,
          slotTemplateId: 1,
          date: future,
          slotTemplate: { startTime: '09:30:00' },
        }),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      await svc.releaseSlot(tx as any, 7);
      expect(tx.remove).toHaveBeenCalled();
    });
  });

  describe('getTodaySnapshot', () => {
    it('returns templates and bookings for the date', async () => {
      templateRepo.find.mockResolvedValue([
        { id: 1, dayOfWeek: 4, startTime: '09:30:00', endTime: '11:30:00', capacity: 10 },
      ]);
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getRawAndEntities: jest.fn().mockResolvedValue({
          entities: [{ id: 7, slotTemplateId: 1, batchOrderId: 99 }],
          raw: [{}],
        }),
      };
      bookingRepo.createQueryBuilder.mockReturnValue(qb);

      const out = await svc.getTodaySnapshot('2026-04-30');
      expect(out.templates).toHaveLength(1);
      expect(out.bookings).toHaveLength(1);
    });
  });

  describe('reorderBookings', () => {
    it('updates priorityRank atomically for each id', async () => {
      const txManager = { update: jest.fn().mockResolvedValue(undefined) };
      dataSource.transaction.mockImplementation(async (cb: any) => cb(txManager));

      await svc.reorderBookings([3, 1, 2]);

      expect(txManager.update).toHaveBeenCalledTimes(3);
      expect(txManager.update).toHaveBeenNthCalledWith(1, expect.anything(), 3, { priorityRank: 1 });
      expect(txManager.update).toHaveBeenNthCalledWith(2, expect.anything(), 1, { priorityRank: 2 });
      expect(txManager.update).toHaveBeenNthCalledWith(3, expect.anything(), 2, { priorityRank: 3 });
    });
  });
});
