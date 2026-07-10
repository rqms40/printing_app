import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  getMetadataArgsStorage,
  Repository,
} from 'typeorm';
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
  let dataSource: { transaction: jest.Mock };

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
    dataSource = {
      transaction: jest.fn(),
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
        { provide: DataSource, useValue: dataSource },
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

  describe('subtractCredits in an order transaction', () => {
    it('locks the user and writes the debit through the supplied manager', async () => {
      const lockedUser = { ...mockUser, credits: 100 } as User;
      const userRepo = {
        findOne: jest.fn().mockResolvedValue(lockedUser),
        save: jest.fn().mockResolvedValue({ ...lockedUser, credits: 60 }),
      };
      const managerTxRepo = {
        create: jest.fn(
          (value: Partial<CreditTransaction>) => value as CreditTransaction,
        ),
        save: jest.fn((value: CreditTransaction) =>
          Promise.resolve({ id: 9, ...value } as CreditTransaction),
        ),
      };
      const manager = {
        getRepository: jest.fn((entity) =>
          entity === User ? userRepo : managerTxRepo,
        ),
      } as unknown as EntityManager;

      await service.subtractCredits(1, 40, 'order_placed', manager);

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ credits: 60 }),
      );
      expect(managerTxRepo.save).toHaveBeenCalled();
      expect(usersService.updateProfile).not.toHaveBeenCalled();
    });
  });

  describe('grantBetaEnrollmentCredits', () => {
    it('records an approved grant and increments the balance in one transaction', async () => {
      const managerTxRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 10 }] }),
      };
      const userRepo = {
        increment: jest.fn().mockResolvedValue({ affected: 1 }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      dataSource.transaction.mockImplementation(
        async (work: (manager: EntityManager) => Promise<unknown>) => {
          await work({
            getRepository: (entity: unknown) =>
              entity === CreditTransaction ? managerTxRepo : userRepo,
          } as unknown as EntityManager);
        },
      );

      await (
        service as CreditsService & {
          grantBetaEnrollmentCredits(
            userId: number,
            amount: number,
          ): Promise<void>;
        }
      ).grantBetaEnrollmentCredits(9, 100);

      expect(managerTxRepo.insert).toHaveBeenCalledWith({
        userId: 9,
        type: CreditTransactionType.TOP_UP,
        amountCredits: 100,
        status: CreditTransactionStatus.APPROVED,
        referenceId: 'BETA-ENROLLMENT:9',
      });
      expect(userRepo.increment).toHaveBeenCalledWith(
        { id: 9 },
        'credits',
        100,
      );
      expect(userRepo.update).toHaveBeenCalledWith(9, {
        betaCreditsGranted: true,
      });
    });

    it('does not increment again when the enrollment ledger already exists', async () => {
      const managerTxRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 10 }),
        insert: jest.fn(),
      };
      const userRepo = { increment: jest.fn(), update: jest.fn() };
      dataSource.transaction.mockImplementation(
        async (work: (manager: EntityManager) => Promise<unknown>) => {
          await work({
            getRepository: (entity: unknown) =>
              entity === CreditTransaction ? managerTxRepo : userRepo,
          } as unknown as EntityManager);
        },
      );

      await (
        service as CreditsService & {
          grantBetaEnrollmentCredits(
            userId: number,
            amount: number,
          ): Promise<void>;
        }
      ).grantBetaEnrollmentCredits(9, 100);

      expect(managerTxRepo.insert).not.toHaveBeenCalled();
      expect(userRepo.increment).not.toHaveBeenCalled();
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('treats a concurrent unique-key loser as an idempotent success', async () => {
      dataSource.transaction.mockRejectedValue({
        driverError: {
          code: '23505',
          constraint: 'uq_credit_transactions_beta_enrollment_reference',
        },
      });

      await expect(
        service.grantBetaEnrollmentCredits(9, 100),
      ).resolves.toBeUndefined();
    });

    it('does not hide an unrelated unique-constraint failure', async () => {
      dataSource.transaction.mockRejectedValue({
        driverError: { code: '23505', constraint: 'some_other_constraint' },
      });

      await expect(
        service.grantBetaEnrollmentCredits(9, 100),
      ).rejects.toMatchObject({
        driverError: {
          code: '23505',
          constraint: 'some_other_constraint',
        },
      });
    });

    it('does not hide non-unique transaction failures', async () => {
      dataSource.transaction.mockRejectedValue(new Error('database offline'));

      await expect(service.grantBetaEnrollmentCredits(9, 100)).rejects.toThrow(
        'database offline',
      );
    });
  });

  it('declares beta enrollment references unique without constraining other references', () => {
    const index = getMetadataArgsStorage().indices.find(
      (candidate) =>
        candidate.target === CreditTransaction &&
        candidate.name === 'uq_credit_transactions_beta_enrollment_reference',
    );

    expect(index).toMatchObject({
      unique: true,
      where: `"reference_id" LIKE 'BETA-ENROLLMENT:%'`,
    });
  });
});
