import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  getMetadataArgsStorage,
  Repository,
} from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
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

  function mockLedgerManager(
    lockedUser: User,
    findByKey: jest.Mock = jest.fn().mockResolvedValue(null),
  ) {
    let nextId = 100;
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(lockedUser),
      save: jest.fn().mockImplementation(async (user: User) => user),
    };
    const managerTxRepo = {
      findOne: findByKey,
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(
        (value: Partial<CreditTransaction>) => value as CreditTransaction,
      ),
      save: jest
        .fn()
        .mockImplementation(async (transaction: CreditTransaction) => ({
          id: nextId++,
          ...transaction,
        })),
    };
    const manager = {
      getRepository: (entity: unknown) =>
        entity === User ? userRepo : managerTxRepo,
    } as unknown as EntityManager;
    return { userRepo, managerTxRepo, manager };
  }

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
    it('rejects client top-up with 410 Gone (grant-only Pilot Credits)', async () => {
      await expect(service.requestTopUp()).rejects.toBeInstanceOf(
        GoneException,
      );
      await expect(service.requestTopUp()).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'pilot_credits_topup_disabled',
        }),
      });
      expect(txRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('pilot ledger grant → reserve → spend', () => {
    it('grants Pilot Credits with reason and optional expiry', async () => {
      const lockedUser = { ...mockUser, credits: 0 } as User;
      const { userRepo, managerTxRepo, manager } =
        mockLedgerManager(lockedUser);
      dataSource.transaction.mockImplementation(
        async (work: (m: EntityManager) => Promise<unknown>) => work(manager),
      );

      const result = await service.grantPilotCredits(
        {
          userId: 1,
          amount: 100,
          reason: 'Pilot cohort grant',
          expiresAt: '2026-12-31T00:00:00.000Z',
        },
        99,
      );

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ credits: 100 }),
      );
      expect(managerTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: CreditTransactionType.GRANT,
          amountCredits: 100,
          reason: 'Pilot cohort grant',
          actorUserId: 99,
          balanceBefore: 0,
          balanceAfter: 100,
        }),
      );
      expect(result.balance).toBe(100);
      expect(notificationsService.triggerCreditsUpdate).toHaveBeenCalledWith(
        1,
        100,
      );
    });

    it('requires a grant reason', async () => {
      await expect(
        service.grantPilotCredits(
          { userId: 1, amount: 50, reason: '   ' },
          99,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    function ledgerHarness(initialCredits = 0) {
      const lockedUser = { ...mockUser, credits: initialCredits } as User;
      const ledgerByKey = new Map<string, CreditTransaction>();
      let nextId = 1;

      const userRepo = {
        findOne: jest.fn().mockResolvedValue(lockedUser),
        save: jest.fn().mockImplementation(async (user: User) => user),
      };
      const managerTxRepo = {
        findOne: jest.fn(
          async ({ where }: { where: { idempotencyKey?: string } }) => {
            if (where.idempotencyKey) {
              return ledgerByKey.get(where.idempotencyKey) ?? null;
            }
            return null;
          },
        ),
        create: jest.fn(
          (value: Partial<CreditTransaction>) => value as CreditTransaction,
        ),
        save: jest
          .fn()
          .mockImplementation(async (transaction: CreditTransaction) => {
            const saved = {
              id: transaction.id ?? nextId++,
              ...transaction,
            } as CreditTransaction;
            if (saved.idempotencyKey) {
              ledgerByKey.set(saved.idempotencyKey, saved);
            }
            return saved;
          }),
      };
      const manager = {
        getRepository: (entity: unknown) =>
          entity === User ? userRepo : managerTxRepo,
      } as unknown as EntityManager;
      dataSource.transaction.mockImplementation(
        async (work: (m: EntityManager) => Promise<unknown>) => work(manager),
      );
      return { lockedUser, ledgerByKey, userRepo, managerTxRepo, manager };
    }

    it('runs grant → reserve → spend without double-debiting on spend', async () => {
      const { lockedUser, ledgerByKey } = ledgerHarness(0);

      await service.grantPilotCredits(
        { userId: 1, amount: 200, reason: 'QA pilot pack' },
        7,
      );
      expect(Number(lockedUser.credits)).toBe(200);

      await service.reserveCredits(1, 75, 'reserve:order:42', {
        referenceId: 'ORD-42',
      });
      expect(Number(lockedUser.credits)).toBe(125);

      const spend = await service.spendCredits(1, 75, 'spend:order:42', {
        reserveIdempotencyKey: 'reserve:order:42',
        referenceId: 'ORD-42',
      });
      // Spend settling a reserve does not deduct again
      expect(Number(lockedUser.credits)).toBe(125);
      expect(spend.transaction.type).toBe(CreditTransactionType.SPEND);
      expect(spend.balanceChanged).toBe(false);
      expect(ledgerByKey.get('reserve:order:42')?.status).toBe(
        CreditTransactionStatus.SETTLED,
      );

      // Idempotent spend replay (same spend key)
      const replay = await service.spendCredits(1, 75, 'spend:order:42', {
        reserveIdempotencyKey: 'reserve:order:42',
      });
      expect(replay.balanceChanged).toBe(false);
      expect(Number(lockedUser.credits)).toBe(125);
    });

    it('rejects free release without a matching reserve (mint hole)', async () => {
      await expect(
        service.releaseCredits(1, 50, 'release:free:1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.releaseCredits(1, 50, 'release:free:2', {}),
      ).rejects.toThrow(/matching unsettled reserve/i);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects double-release of the same reserve', async () => {
      const { lockedUser } = ledgerHarness(100);

      await service.reserveCredits(1, 40, 'reserve:order:99');
      expect(Number(lockedUser.credits)).toBe(60);

      const first = await service.releaseCredits(1, 40, 'release:order:99:a', {
        reserveIdempotencyKey: 'reserve:order:99',
      });
      expect(Number(lockedUser.credits)).toBe(100);
      expect(first.transaction.type).toBe(CreditTransactionType.RELEASE);

      await expect(
        service.releaseCredits(1, 40, 'release:order:99:b', {
          reserveIdempotencyKey: 'reserve:order:99',
        }),
      ).rejects.toThrow(/already settled/i);
      expect(Number(lockedUser.credits)).toBe(100);
    });

    it('rejects double-spend of the same reserve', async () => {
      const { lockedUser } = ledgerHarness(100);

      await service.reserveCredits(1, 30, 'reserve:order:77');
      expect(Number(lockedUser.credits)).toBe(70);

      const first = await service.spendCredits(1, 30, 'spend:order:77:a', {
        reserveIdempotencyKey: 'reserve:order:77',
      });
      expect(Number(lockedUser.credits)).toBe(70);
      expect(first.balanceChanged).toBe(false);

      await expect(
        service.spendCredits(1, 30, 'spend:order:77:b', {
          reserveIdempotencyKey: 'reserve:order:77',
        }),
      ).rejects.toThrow(/already settled/i);
      expect(Number(lockedUser.credits)).toBe(70);
    });

    it('rejects reserve/spend without idempotency key', async () => {
      await expect(service.reserveCredits(1, 10, '  ')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.spendCredits(1, 10, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects insufficient balance on reserve', async () => {
      const lockedUser = { ...mockUser, credits: 5 } as User;
      const { manager } = mockLedgerManager(lockedUser);
      dataSource.transaction.mockImplementation(
        async (work: (m: EntityManager) => Promise<unknown>) => work(manager),
      );

      await expect(
        service.reserveCredits(1, 50, 'reserve:too-much'),
      ).rejects.toThrow('Insufficient Pilot Credits');
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
      const lockedUser = { ...mockUser } as User;
      const userRepo = {
        findOne: jest.fn().mockResolvedValue(lockedUser),
        save: jest.fn().mockImplementation(async (user: User) => user),
      };
      const managerTxRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(refundTx),
        save: jest.fn().mockResolvedValue(refundTx),
      };
      dataSource.transaction.mockImplementation(
        async (work: (manager: EntityManager) => Promise<unknown>) => {
          return work({
            getRepository: (entity: unknown) =>
              entity === User ? userRepo : managerTxRepo,
          } as unknown as EntityManager);
        },
      );

      await service.refundCredits(1, 250, 'ORD-10001');

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ credits: 1250 }),
      );
      expect(notificationsService.triggerCreditsUpdate).toHaveBeenCalledWith(
        1,
        1250,
      );
      expect(managerTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: CreditTransactionType.TOP_UP,
          amountCredits: 250,
          status: CreditTransactionStatus.APPROVED,
          referenceId: 'ORD-10001',
        }),
      );
    });

    it('locks and refunds through a supplied transaction manager', async () => {
      const lockedUser = { ...mockUser, credits: 100 } as User;
      const userRepo = {
        findOne: jest.fn().mockResolvedValue(lockedUser),
        save: jest.fn().mockImplementation(async (user: User) => user),
      };
      const managerTxRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn(
          (value: Partial<CreditTransaction>) => value as CreditTransaction,
        ),
        save: jest
          .fn()
          .mockImplementation(async (transaction: CreditTransaction) => ({
            id: 12,
            ...transaction,
          })),
      };
      const manager = {
        getRepository: (entity: unknown) =>
          entity === User ? userRepo : managerTxRepo,
      } as unknown as EntityManager;

      await service.refundCredits(1, 85, 'BATCH-REFUND:BATCH-10001', manager);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ credits: 185 }),
      );
      expect(managerTxRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          amountCredits: 85,
          referenceId: 'BATCH-REFUND:BATCH-10001',
        }),
      );
    });

    it('returns the existing matching refund without adding balance again', async () => {
      const existing = {
        id: 12,
        userId: 1,
        type: CreditTransactionType.TOP_UP,
        amountCredits: 85,
        status: CreditTransactionStatus.APPROVED,
        referenceId: 'BATCH-REFUND:BATCH-10001',
      } as CreditTransaction;
      const userRepo = {
        findOne: jest.fn().mockResolvedValue({ ...mockUser, credits: 185 }),
        save: jest.fn(),
      };
      const managerTxRepo = {
        find: jest.fn().mockResolvedValue([existing]),
        findOne: jest.fn().mockResolvedValue(existing),
        create: jest.fn(),
        save: jest.fn(),
      };
      const manager = {
        getRepository: (entity: unknown) =>
          entity === User ? userRepo : managerTxRepo,
      } as unknown as EntityManager;

      await expect(
        service.refundCredits(1, 85, 'BATCH-REFUND:BATCH-10001', manager),
      ).resolves.toEqual({
        transaction: existing,
        userId: 1,
        balance: 185,
        balanceChanged: false,
      });

      expect(userRepo.save).not.toHaveBeenCalled();
      expect(managerTxRepo.save).not.toHaveBeenCalled();
    });

    it('defers a manager-aware balance event until the owner publishes after commit', async () => {
      const lockedUser = { ...mockUser, credits: 100 } as User;
      const refundTx = {
        id: 13,
        userId: 1,
        type: CreditTransactionType.TOP_UP,
        amountCredits: 25,
        status: CreditTransactionStatus.APPROVED,
        referenceId: 'ORDER-REFUND:ORD-10001',
      } as CreditTransaction;
      const userRepo = {
        findOne: jest.fn().mockResolvedValue(lockedUser),
        save: jest.fn().mockImplementation(async (user: User) => user),
      };
      const managerTxRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(refundTx),
        save: jest.fn().mockResolvedValue(refundTx),
      };
      const manager = {
        getRepository: (entity: unknown) =>
          entity === User ? userRepo : managerTxRepo,
      } as unknown as EntityManager;

      const mutation = await service.refundCredits(
        1,
        25,
        'ORDER-REFUND:ORD-10001',
        manager,
      );

      expect(notificationsService.triggerCreditsUpdate).not.toHaveBeenCalled();
      (
        service as CreditsService & {
          publishCreditMutation(result: unknown): void;
        }
      ).publishCreditMutation(mutation);
      expect(notificationsService.triggerCreditsUpdate).toHaveBeenCalledWith(
        1,
        125,
      );
    });

    it('publishes a standalone balance event only after its transaction commits', async () => {
      const events: string[] = [];
      const lockedUser = { ...mockUser, credits: 100 } as User;
      const refundTx = {
        id: 14,
        userId: 1,
        type: CreditTransactionType.TOP_UP,
        amountCredits: 25,
        status: CreditTransactionStatus.APPROVED,
        referenceId: 'ORDER-REFUND:ORD-10002',
      } as CreditTransaction;
      const userRepo = {
        findOne: jest.fn().mockResolvedValue(lockedUser),
        save: jest.fn().mockImplementation(async (user: User) => user),
      };
      const managerTxRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(refundTx),
        save: jest.fn().mockResolvedValue(refundTx),
      };
      dataSource.transaction.mockImplementation(async (work) => {
        events.push('transaction-start');
        const result: unknown = await work({
          getRepository: (entity: unknown) =>
            entity === User ? userRepo : managerTxRepo,
        } as unknown as EntityManager);
        events.push('transaction-commit');
        return result;
      });
      notificationsService.triggerCreditsUpdate?.mockImplementation(() => {
        events.push('balance-event');
      });

      await service.refundCredits(1, 25, 'ORDER-REFUND:ORD-10002');

      expect(events).toEqual([
        'transaction-start',
        'transaction-commit',
        'balance-event',
      ]);
    });

    it.each([
      ['user', { userId: 2 }],
      ['type', { type: CreditTransactionType.DEDUCTION }],
      ['status', { status: CreditTransactionStatus.REJECTED }],
      ['purchased top-up', { amountPhp: 25 }],
    ])(
      'rejects a mismatched legacy refund alias %s instead of crediting again',
      async (_label, mismatch) => {
        const lockedUser = { ...mockUser, credits: 100 } as User;
        const mismatched = {
          id: 15,
          userId: 1,
          type: CreditTransactionType.TOP_UP,
          amountCredits: 25,
          status: CreditTransactionStatus.APPROVED,
          referenceId: 'ORD-10003',
          ...mismatch,
        } as CreditTransaction;
        const userRepo = {
          findOne: jest.fn().mockResolvedValue(lockedUser),
          save: jest.fn(),
        };
        const managerTxRepo = {
          find: jest.fn().mockResolvedValue([mismatched]),
          findOne: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          save: jest.fn(),
        };
        const manager = {
          getRepository: (entity: unknown) =>
            entity === User ? userRepo : managerTxRepo,
        } as unknown as EntityManager;

        await expect(
          (
            service.refundCredits as unknown as (
              userId: number,
              amount: number,
              reference: string,
              manager: EntityManager,
              aliases: string[],
            ) => Promise<unknown>
          )(1, 25, 'ORDER-REFUND:ORD-10003', manager, ['ORD-10003']),
        ).rejects.toThrow('Credit refund ledger reference mismatch');
        expect(userRepo.save).not.toHaveBeenCalled();
      },
    );

    it('rejects legacy refund totals above the authoritative charge', async () => {
      const lockedUser = { ...mockUser, credits: 190 } as User;
      const existing = ['ORD-10004', 'ORD-10005'].map(
        (referenceId, index) =>
          ({
            id: 16 + index,
            userId: 1,
            type: CreditTransactionType.TOP_UP,
            amountCredits: 45,
            status: CreditTransactionStatus.APPROVED,
            referenceId,
          }) as CreditTransaction,
      );
      const userRepo = {
        findOne: jest.fn().mockResolvedValue(lockedUser),
        save: jest.fn(),
      };
      const managerTxRepo = {
        find: jest.fn().mockResolvedValue(existing),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        save: jest.fn(),
      };
      const manager = {
        getRepository: (entity: unknown) =>
          entity === User ? userRepo : managerTxRepo,
      } as unknown as EntityManager;

      await expect(
        (
          service.refundCredits as unknown as (
            userId: number,
            amount: number,
            reference: string,
            manager: EntityManager,
            aliases: string[],
          ) => Promise<unknown>
        )(1, 85, 'BATCH-REFUND:BATCH-10001', manager, [
          'ORD-10004',
          'ORD-10005',
        ]),
      ).rejects.toThrow('Credit refund ledger reference mismatch');
      expect(userRepo.save).not.toHaveBeenCalled();
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
      expect(notificationsService.triggerCreditsUpdate).not.toHaveBeenCalled();
    });
  });

  describe('grantBetaEnrollmentCredits', () => {
    it('records an approved grant and increments the balance in one transaction', async () => {
      const managerTxRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 10 }] }),
      };
      const userRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 9,
          credits: 0,
          betaCreditsGranted: false,
        }),
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
        reason: 'Beta enrollment grant',
      });
      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { id: 9 },
        lock: { mode: 'pessimistic_write' },
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

    it('repairs a false grant flag without incrementing when the enrollment ledger already exists', async () => {
      const managerTxRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          userId: 9,
          type: CreditTransactionType.TOP_UP,
          amountCredits: 100,
          status: CreditTransactionStatus.APPROVED,
          referenceId: 'BETA-ENROLLMENT:9',
        }),
        insert: jest.fn(),
      };
      const userRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 9,
          credits: 100,
          betaCreditsGranted: false,
        }),
        increment: jest.fn(),
        update: jest.fn(),
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

      expect(managerTxRepo.insert).not.toHaveBeenCalled();
      expect(userRepo.increment).not.toHaveBeenCalled();
      expect(userRepo.update).toHaveBeenCalledWith(9, {
        betaCreditsGranted: true,
      });
    });

    it('backfills a legacy granted user ledger without changing the balance', async () => {
      const managerTxRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockResolvedValue({ identifiers: [{ id: 11 }] }),
      };
      const userRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 9,
          credits: 100,
          betaCreditsGranted: true,
        }),
        increment: jest.fn(),
        update: jest.fn(),
      };
      const manager = {
        getRepository: (entity: unknown) =>
          entity === CreditTransaction ? managerTxRepo : userRepo,
      } as unknown as EntityManager;

      await service.grantBetaEnrollmentCredits(9, 100, manager);

      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(managerTxRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 9,
          amountCredits: 100,
          referenceId: 'BETA-ENROLLMENT:9',
        }),
      );
      expect(userRepo.increment).not.toHaveBeenCalled();
      expect(userRepo.update).not.toHaveBeenCalled();
    });

    it('rejects a beta enrollment reference owned by another user', async () => {
      const managerTxRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 10,
          userId: 8,
          type: CreditTransactionType.TOP_UP,
          amountCredits: 100,
          status: CreditTransactionStatus.APPROVED,
          referenceId: 'BETA-ENROLLMENT:9',
        }),
      };
      const userRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 9,
          credits: 0,
          betaCreditsGranted: false,
        }),
      };
      const manager = {
        getRepository: (entity: unknown) =>
          entity === CreditTransaction ? managerTxRepo : userRepo,
      } as unknown as EntityManager;

      await expect(
        service.grantBetaEnrollmentCredits(9, 100, manager),
      ).rejects.toThrow('Beta enrollment ledger reference mismatch');
    });

    it('treats a concurrent unique-key loser as an idempotent success', async () => {
      dataSource.transaction
        .mockRejectedValueOnce({
          driverError: {
            code: '23505',
            constraint: 'uq_credit_transactions_beta_enrollment_reference',
          },
        })
        .mockResolvedValueOnce(undefined);

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

  it('declares stable order and batch refund references unique without constraining other references', () => {
    const index = getMetadataArgsStorage().indices.find(
      (candidate) =>
        candidate.target === CreditTransaction &&
        candidate.name === 'uq_credit_transactions_refund_reference',
    );

    expect(index).toMatchObject({
      unique: true,
      where:
        `"reference_id" LIKE 'ORDER-REFUND:%' OR ` +
        `"reference_id" LIKE 'BATCH-REFUND:%'`,
    });
  });

  it('declares idempotency keys unique when present', () => {
    const index = getMetadataArgsStorage().indices.find(
      (candidate) =>
        candidate.target === CreditTransaction &&
        candidate.name === 'uq_credit_transactions_idempotency_key',
    );

    expect(index).toMatchObject({
      unique: true,
      where: `"idempotency_key" IS NOT NULL`,
    });
  });
});

