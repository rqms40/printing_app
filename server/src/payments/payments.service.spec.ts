import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentTransaction } from './entities/payment-transaction.entity';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let txnRepo: jest.Mocked<Partial<Repository<PaymentTransaction>>>;

  const mockTxn = {
    id: 1,
    orderId: 1,
    paymentMethod: 'gcash',
    amount: 500,
    status: 'pending',
  } as PaymentTransaction;

  beforeEach(async () => {
    txnRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(PaymentTransaction), useValue: txnRepo },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('createIntent', () => {
    it('should create pending transaction and return checkout URL', async () => {
      txnRepo.create.mockReturnValue(mockTxn);
      txnRepo.save.mockResolvedValue(mockTxn);

      const dto = { orderId: 1, paymentMethod: 'gcash', amount: 500 } as any;
      const result = await service.createIntent(dto);

      expect(txnRepo.create).toHaveBeenCalledWith({
        orderId: 1,
        paymentMethod: 'gcash',
        amount: 500,
        status: 'pending',
      });
      expect(result.transaction).toEqual(mockTxn);
      expect(result.checkoutUrl).toContain('https://checkout.paymongo.com/mock/');
      expect(result.checkoutUrl).toContain(String(mockTxn.id));
    });
  });

  describe('confirmPayment', () => {
    it('should mark transaction as success when pending', async () => {
      const pendingTxn = { ...mockTxn, status: 'pending' } as PaymentTransaction;
      txnRepo.findOne.mockResolvedValue(pendingTxn);
      txnRepo.save.mockImplementation(async (t) => t as PaymentTransaction);

      const result = await service.confirmPayment(1);

      expect(result.status).toBe('success');
    });

    it('should throw NotFoundException if transaction not found', async () => {
      txnRepo.findOne.mockResolvedValue(null);

      await expect(service.confirmPayment(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if transaction is not pending', async () => {
      const successTxn = { ...mockTxn, status: 'success' } as PaymentTransaction;
      txnRepo.findOne.mockResolvedValue(successTxn);

      await expect(service.confirmPayment(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('initiateRefund', () => {
    it('should mark successful transaction as refunded', async () => {
      const successTxn = { ...mockTxn, status: 'success' } as PaymentTransaction;
      txnRepo.findOne.mockResolvedValue(successTxn);
      txnRepo.save.mockImplementation(async (t) => t as PaymentTransaction);

      const result = await service.initiateRefund(1);

      expect(result.status).toBe('refunded');
    });

    it('should throw NotFoundException if transaction not found', async () => {
      txnRepo.findOne.mockResolvedValue(null);

      await expect(service.initiateRefund(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if transaction is not successful', async () => {
      const pendingTxn = { ...mockTxn, status: 'pending' } as PaymentTransaction;
      txnRepo.findOne.mockResolvedValue(pendingTxn);

      await expect(service.initiateRefund(1)).rejects.toThrow(BadRequestException);
    });
  });
});
