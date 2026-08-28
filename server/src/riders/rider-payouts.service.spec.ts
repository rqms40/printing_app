import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RiderPayoutsService } from './rider-payouts.service';
import { DeliveryStatus } from './entities/delivery-assignment.entity';
import { FilePurpose } from '../files/entities/file-metadata.entity';

describe('RiderPayoutsService', () => {
  let service: RiderPayoutsService;
  let payoutRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let profileRepo: { findOne: jest.Mock };
  let assignmentRepo: { find: jest.Mock; findOne: jest.Mock };
  let filesService: { findById: jest.Mock; getPresignedUrlForKey: jest.Mock };

  beforeEach(() => {
    payoutRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (row) => ({ id: row.id ?? 1, ...row })),
      create: jest.fn((row) => row),
    };
    profileRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 10,
        userId: 7,
        payoutQrFileId: 55,
      }),
    };
    assignmentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    filesService = {
      findById: jest.fn().mockResolvedValue({
        id: 91,
        uploadedBy: 3,
        purpose: FilePurpose.PAYOUT_RECEIPT,
        objectKey: 'uploads/payout_receipt/r.jpg',
      }),
      getPresignedUrlForKey: jest.fn().mockResolvedValue('https://files/qr'),
    };
    service = new RiderPayoutsService(
      payoutRepo as any,
      profileRepo as any,
      assignmentRepo as any,
      filesService as any,
    );
  });

  it('lists completed deliveries as unpaid until a receipt is recorded', async () => {
    assignmentRepo.find.mockResolvedValue([
      {
        id: 100,
        orderId: 42,
        riderId: 10,
        status: DeliveryStatus.DELIVERED,
        deliveredAt: new Date('2026-08-28T08:00:00Z'),
        order: { orderId: 'ORD-42', deliveryFee: 50 },
      },
    ]);
    filesService.findById.mockResolvedValue({
      id: 55,
      objectKey: 'uploads/rider_payout_qr/q.jpg',
    });

    const view = await service.listForAdmin(10);
    expect(view.riderId).toBe(10);
    expect(view.items).toHaveLength(1);
    expect(view.items[0].status).toBe('unpaid');
    expect(view.items[0].orderRef).toBe('ORD-42');
    expect(view.items[0].amountMinor).toBe('5000');
  });

  it('records an admin receipt against a delivered assignment', async () => {
    assignmentRepo.findOne.mockResolvedValue({
      id: 100,
      orderId: 42,
      riderId: 10,
      status: DeliveryStatus.DELIVERED,
      order: { orderId: 'ORD-42', deliveryFeeMinor: '5000' },
    });
    assignmentRepo.find.mockResolvedValue([
      {
        id: 100,
        orderId: 42,
        riderId: 10,
        status: DeliveryStatus.DELIVERED,
        deliveredAt: new Date(),
        order: { orderId: 'ORD-42', deliveryFeeMinor: '5000' },
      },
    ]);
    payoutRepo.find.mockResolvedValue([
      {
        assignmentId: 100,
        adminReceiptFileId: 91,
        paidAt: new Date(),
      },
    ]);

    const view = await service.recordReceipt(
      10,
      { assignmentId: 100, receiptFileId: 91 },
      3,
    );
    expect(payoutRepo.create).toHaveBeenCalled();
    expect(payoutRepo.save).toHaveBeenCalled();
    expect(view.items[0].status).toBe('paid');
  });

  it('rejects payout when the rider has no QR', async () => {
    profileRepo.findOne.mockResolvedValue({
      id: 10,
      userId: 7,
      payoutQrFileId: null,
    });
    await expect(
      service.recordReceipt(10, { assignmentId: 100, receiptFileId: 91 }, 3),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects payout for a missing rider', async () => {
    profileRepo.findOne.mockResolvedValue(null);
    await expect(service.listForAdmin(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
