import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CreditsService } from './credits.service';
import {
  CreditTransaction,
  CreditTransactionStatus,
  CreditTransactionType,
} from './entities/credit-transaction.entity';
import { CreditSettings } from './entities/credit-settings.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { User } from '../users/entities/user.entity';

describe('CreditsService', () => {
  let service: CreditsService;
  let txRepo: jest.Mocked<Partial<Repository<CreditTransaction>>>;
  let settingsRepo: jest.Mocked<Partial<Repository<CreditSettings>>>;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let notificationsService: jest.Mocked<Partial<NotificationsService>>;

  const mockUser = { id: 1, email: 'user@gridgo.ph', credits: 1000 } as User;
  const mockSettings = { id: 1, conversionRate: 1.0 } as CreditSettings;
  const mockTx = {
    id: 5,
    userId: 1,
    type: CreditTransactionType.TOP_UP,
    amountPhp: 500,
    amountCredits: 500,
    status: CreditTransactionStatus.PENDING,
  } as CreditTransaction;

  beforeEach(async () => {
    txRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    settingsRepo = {
      find: jest.fn().mockResolvedValue([mockSettings]),
      create: jest.fn(),
      save: jest.fn(),
    };
    usersService = {
      findById: jest.fn().mockResolvedValue({ ...mockUser }),
      updateProfile: jest.fn().mockResolvedValue(mockUser),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      createForAllAdmins: jest.fn().mockResolvedValue(undefined),
      triggerCreditsUpdate: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        CreditsService,
        { provide: getRepositoryToken(CreditTransaction), useValue: txRepo },
        { provide: getRepositoryToken(CreditSettings), useValue: settingsRepo },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: FirebaseService,
          useValue: { sendToDevice: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: NotificationsGateway,
          useValue: {
            notifyUser: jest.fn(),
            notifyUserCreditsUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(CreditsService);
  });

  describe('requestTopUp', () => {
    it('saves the transaction and notifies all admins', async () => {
      txRepo.create.mockReturnValue(mockTx);
      txRepo.save.mockResolvedValue(mockTx);

      const result = await service.requestTopUp(1, {
        amountPhp: 500,
        proofOfPaymentUrl: 'https://example.com/proof.jpg',
      });

      expect(txRepo.save).toHaveBeenCalled();
      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'topup_request' }),
      );
      expect(result).toEqual(mockTx);
    });
  });

  describe('rejectTopUp', () => {
    it('rejects the transaction AND notifies the customer', async () => {
      txRepo.findOne.mockResolvedValue({ ...mockTx });
      txRepo.save.mockResolvedValue({
        ...mockTx,
        status: CreditTransactionStatus.REJECTED,
      });

      await service.rejectTopUp(5);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockTx.userId,
          type: 'topup_rejected',
        }),
      );
    });

    it('throws NotFoundException when transaction does not exist', async () => {
      txRepo.findOne.mockResolvedValue(null);

      await expect(service.rejectTopUp(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('approveTopUp', () => {
    it('approves and notifies the customer', async () => {
      txRepo.findOne.mockResolvedValue({ ...mockTx });
      txRepo.save.mockResolvedValue({
        ...mockTx,
        status: CreditTransactionStatus.APPROVED,
      });

      await service.approveTopUp(5);

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: mockTx.userId, type: 'credit' }),
      );
    });

    it('throws BadRequestException when transaction is not pending', async () => {
      txRepo.findOne.mockResolvedValue({
        ...mockTx,
        status: CreditTransactionStatus.APPROVED,
      });

      await expect(service.approveTopUp(5)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('refundCredits', () => {
    it('adds credits back to the user and records an approved credit transaction without requiring a new DB enum value', async () => {
      const refundTx = {
        id: 6,
        userId: 1,
        type: CreditTransactionType.TOP_UP,
        amountCredits: 250,
        status: CreditTransactionStatus.APPROVED,
        referenceId: 'ORD-10001',
      } as CreditTransaction;
      txRepo.create.mockReturnValue(refundTx);
      txRepo.save.mockResolvedValue(refundTx);

      await service.refundCredits(1, 250, 'ORD-10001');

      expect(usersService.updateProfile).toHaveBeenCalledWith(1, {
        credits: 1250,
      });
      expect(notificationsService.triggerCreditsUpdate).toHaveBeenCalledWith(
        1,
        1250,
      );
      expect(txRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: CreditTransactionType.TOP_UP,
          amountCredits: 250,
          status: CreditTransactionStatus.APPROVED,
          referenceId: 'ORD-10001',
        }),
      );
    });
  });
});
