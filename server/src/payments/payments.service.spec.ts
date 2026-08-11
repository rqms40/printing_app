import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import {
  CodCollection,
  CodCollectionStatus,
} from './entities/cod-collection.entity';
import { QrPaymentReceipt } from './entities/qr-payment-receipt.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import {
  Payout,
  PayoutSettlementState,
} from '../payouts/entities/payout.entity';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import {
  COD_PAYOUT_HOLD_REASON,
  CodIneligibilityReason,
} from './cod-eligibility';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let txnRepo: jest.Mocked<Partial<Repository<PaymentTransaction>>>;
  let codRepo: jest.Mocked<Partial<Repository<CodCollection>>>;
  let qrReceiptRepo: jest.Mocked<Partial<Repository<QrPaymentReceipt>>>;
  let ordersRepo: jest.Mocked<
    Partial<Repository<Order>> & {
      createQueryBuilder: jest.Mock;
      manager?: { transaction: jest.Mock };
    }
  >;
  let usersRepo: jest.Mocked<Partial<Repository<User>>>;
  let payoutRepo: jest.Mocked<Partial<Repository<Payout>>>;
  let fileRepo: jest.Mocked<Partial<Repository<FileMetadata>>>;
  let configValues: Record<string, string | undefined>;

  const mockTxn = {
    id: 1,
    orderId: 1,
    paymentMethod: 'gcash',
    amount: 500,
    status: 'pending',
  } as PaymentTransaction;

  async function buildService(
    env: Record<string, string | undefined> = {},
  ): Promise<PaymentsService> {
    configValues = {
      PAYMONGO_LIVE_ENABLED: 'false',
      PAYMONGO_SECRET_KEY: undefined,
      ...env,
    };
    const mockConfig = {
      get: jest.fn((key: string, def?: string) => {
        if (Object.prototype.hasOwnProperty.call(configValues, key)) {
          return configValues[key] ?? def;
        }
        return def;
      }),
    };

    txnRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    codRepo = {
      findOne: jest.fn(),
      create: jest.fn((row) => row as CodCollection),
      save: jest.fn(async (row) => ({ id: 10, ...row }) as CodCollection),
    };
    qrReceiptRepo = {
      findOne: jest.fn(),
      create: jest.fn((row) => row as QrPaymentReceipt),
      save: jest.fn(async (row) => ({ id: 20, ...row }) as QrPaymentReceipt),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(),
    };
    ordersRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (o) => o as Order),
      createQueryBuilder: jest.fn(),
      manager: {
        transaction: jest.fn(async (fn) =>
          fn({
            getRepository: jest.fn(() => ({
              findOne: jest.fn(),
              save: jest.fn(async (x) => x),
              create: jest.fn((x) => x),
            })),
          }),
        ),
      },
    };
    usersRepo = {
      findOne: jest.fn(),
    };
    payoutRepo = {
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(async (p) => p as Payout),
    };
    fileRepo = {
      findOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(PaymentTransaction), useValue: txnRepo },
        { provide: getRepositoryToken(CodCollection), useValue: codRepo },
        { provide: getRepositoryToken(QrPaymentReceipt), useValue: qrReceiptRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        { provide: getRepositoryToken(Payout), useValue: payoutRepo },
        { provide: getRepositoryToken(FileMetadata), useValue: fileRepo },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    return module.get(PaymentsService);
  }

  beforeEach(async () => {
    service = await buildService();
  });

  describe('createIntent', () => {
    it('should create pending transaction and return checkout URL', async () => {
      txnRepo.create!.mockReturnValue(mockTxn);
      txnRepo.save!.mockResolvedValue(mockTxn);

      const dto = { orderId: 1, paymentMethod: 'gcash', amount: 500 } as any;
      const result = await service.createIntent(dto);

      expect(txnRepo.create).toHaveBeenCalledWith({
        orderId: 1,
        paymentMethod: 'gcash',
        amount: 500,
        status: 'pending',
      });
      expect(result.transaction).toEqual(mockTxn);
      expect(result.checkoutUrl).toContain(
        'https://checkout.paymongo.com/mock/',
      );
      expect(result.checkoutUrl).toContain(String(mockTxn.id));
    });
  });

  describe('PayMongo sandbox-only guard (Task 3.4)', () => {
    it('defaults live enabled to false', () => {
      expect(service.isPayMongoLiveEnabled()).toBe(false);
    });

    it('allows mock createIntent when live flag off and no live secret', async () => {
      txnRepo.create!.mockReturnValue(mockTxn);
      txnRepo.save!.mockResolvedValue(mockTxn);

      await expect(
        service.createIntent({
          orderId: 1,
          paymentMethod: 'gcash',
          amount: 500,
        } as any),
      ).resolves.toBeDefined();
    });

    it('allows sandbox sk_test_ secret when live flag is off', async () => {
      service = await buildService({
        PAYMONGO_LIVE_ENABLED: 'false',
        PAYMONGO_SECRET_KEY: 'sk_test_sandbox_key',
      });
      txnRepo.create!.mockReturnValue(mockTxn);
      txnRepo.save!.mockResolvedValue(mockTxn);

      await expect(
        service.createIntent({
          orderId: 1,
          paymentMethod: 'gcash',
          amount: 500,
        } as any),
      ).resolves.toBeDefined();
      expect(service.isPayMongoLiveSecretConfigured()).toBe(false);
    });

    it('blocks createIntent when sk_live_ secret and live flag off', async () => {
      service = await buildService({
        PAYMONGO_LIVE_ENABLED: 'false',
        PAYMONGO_SECRET_KEY: 'sk_live_real_money',
      });

      await expect(
        service.createIntent({
          orderId: 1,
          paymentMethod: 'gcash',
          amount: 500,
        } as any),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'paymongo_live_disabled',
        }),
      });
      expect(txnRepo.create).not.toHaveBeenCalled();
    });

    it('blocks confirmPayment / refund / webhook with live secret and flag off', async () => {
      service = await buildService({
        PAYMONGO_LIVE_ENABLED: 'false',
        PAYMONGO_SECRET_KEY: 'sk_live_real_money',
      });

      await expect(service.confirmPayment(1)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'paymongo_live_disabled' }),
      });
      await expect(service.initiateRefund(1)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'paymongo_live_disabled' }),
      });
      await expect(
        service.handleWebhook({
          data: {
            attributes: {
              reference_number: 'ref-1',
              type: 'payment.paid',
            },
          },
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'paymongo_live_disabled' }),
      });
    });

    it('allows live secret only when PAYMONGO_LIVE_ENABLED is true', async () => {
      service = await buildService({
        PAYMONGO_LIVE_ENABLED: 'true',
        PAYMONGO_SECRET_KEY: 'sk_live_real_money',
      });
      expect(service.isPayMongoLiveEnabled()).toBe(true);

      txnRepo.create!.mockReturnValue(mockTxn);
      txnRepo.save!.mockResolvedValue(mockTxn);

      await expect(
        service.createIntent({
          orderId: 1,
          paymentMethod: 'gcash',
          amount: 500,
        } as any),
      ).resolves.toBeDefined();
    });
  });

  describe('confirmPayment', () => {
    it('should mark transaction as success when pending', async () => {
      const pendingTxn = {
        ...mockTxn,
        status: 'pending',
      } as PaymentTransaction;
      txnRepo.findOne!.mockResolvedValue(pendingTxn);
      txnRepo.save!.mockImplementation(async (t) => t as PaymentTransaction);

      const result = await service.confirmPayment(1);

      expect(result.status).toBe('success');
    });

    it('should throw NotFoundException if transaction not found', async () => {
      txnRepo.findOne!.mockResolvedValue(null);

      await expect(service.confirmPayment(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if transaction is not pending', async () => {
      const successTxn = {
        ...mockTxn,
        status: 'success',
      } as PaymentTransaction;
      txnRepo.findOne!.mockResolvedValue(successTxn);

      await expect(service.confirmPayment(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('initiateRefund', () => {
    it('should mark successful transaction as refunded', async () => {
      const successTxn = {
        ...mockTxn,
        status: 'success',
      } as PaymentTransaction;
      txnRepo.findOne!.mockResolvedValue(successTxn);
      txnRepo.save!.mockImplementation(async (t) => t as PaymentTransaction);

      const result = await service.initiateRefund(1);

      expect(result.status).toBe('refunded');
    });

    it('should throw NotFoundException if transaction not found', async () => {
      txnRepo.findOne!.mockResolvedValue(null);

      await expect(service.initiateRefund(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if transaction is not successful', async () => {
      const pendingTxn = {
        ...mockTxn,
        status: 'pending',
      } as PaymentTransaction;
      txnRepo.findOne!.mockResolvedValue(pendingTxn);

      await expect(service.initiateRefund(1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertCodEligibleForCheckout', () => {
    function mockActiveCount(count: number) {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(count),
      };
      ordersRepo.createQueryBuilder.mockReturnValue(qb as any);
      return qb;
    }

    it('passes through non-COD payment methods', async () => {
      const result = await service.assertCodEligibleForCheckout({
        userId: 1,
        paymentMethod: 'pilot_credit',
        finalTotalMinor: '200000',
      });
      expect(result).toBeNull();
      expect(usersRepo.findOne).not.toHaveBeenCalled();
    });

    it('rejects ₱1,501 COD even when client is pilot verified', async () => {
      usersRepo.findOne!.mockResolvedValue({
        id: 1,
        pilotCodEligible: true,
        codOpsRiskBlocked: false,
      } as User);
      mockActiveCount(0);

      await expect(
        service.assertCodEligibleForCheckout({
          userId: 1,
          paymentMethod: 'cod',
          finalTotalMinor: '150100',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'cod_not_eligible',
          reasons: expect.arrayContaining([
            CodIneligibilityReason.AMOUNT_EXCEEDS_CAP,
          ]),
        }),
      });
    });

    it('rejects COD when client is not pilot verified', async () => {
      usersRepo.findOne!.mockResolvedValue({
        id: 1,
        pilotCodEligible: false,
        codOpsRiskBlocked: false,
      } as User);
      mockActiveCount(0);

      await expect(
        service.assertCodEligibleForCheckout({
          userId: 1,
          paymentMethod: 'cod',
          finalTotalMinor: '50000',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows eligible COD under the cap', async () => {
      usersRepo.findOne!.mockResolvedValue({
        id: 1,
        pilotCodEligible: true,
        codOpsRiskBlocked: false,
      } as User);
      mockActiveCount(0);

      const result = await service.assertCodEligibleForCheckout({
        userId: 1,
        paymentMethod: 'cod',
        finalTotalMinor: '150000',
      });

      expect(result?.eligible).toBe(true);
      expect(result?.amountMinor).toBe('150000');
    });

    it('rejects when client already has an active unpaid COD order', async () => {
      usersRepo.findOne!.mockResolvedValue({
        id: 1,
        pilotCodEligible: true,
        codOpsRiskBlocked: false,
      } as User);
      mockActiveCount(1);

      await expect(
        service.assertCodEligibleForCheckout({
          userId: 1,
          paymentMethod: 'cod',
          finalTotalMinor: '10000',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          reasons: expect.arrayContaining([
            CodIneligibilityReason.ACTIVE_UNPAID_COD,
          ]),
        }),
      });
    });
  });

  describe('evaluateCodEligibilityForOrders', () => {
    it('loads policy once and applies exact current-order exclusion to every quote', async () => {
      usersRepo.findOne!.mockResolvedValue({
        id: 1,
        pilotCodEligible: true,
        codOpsRiskBlocked: false,
      } as User);
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ id: 41 }]),
      };
      ordersRepo.createQueryBuilder.mockReturnValue(qb as any);

      const results = await service.evaluateCodEligibilityForOrders(1, [
        { orderId: 41, finalTotalMinor: '150000' },
        { orderId: 42, finalTotalMinor: '150000' },
        { orderId: 43, finalTotalMinor: '150100' },
      ]);

      expect(usersRepo.findOne).toHaveBeenCalledTimes(1);
      expect(ordersRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(qb.getRawMany).toHaveBeenCalledTimes(1);
      expect(results.get(41)?.eligible).toBe(true);
      expect(results.get(42)).toMatchObject({
        eligible: false,
        reasons: expect.arrayContaining([
          CodIneligibilityReason.ACTIVE_UNPAID_COD,
        ]),
      });
      expect(results.get(43)).toMatchObject({
        eligible: false,
        reasons: expect.arrayContaining([
          CodIneligibilityReason.AMOUNT_EXCEEDS_CAP,
          CodIneligibilityReason.ACTIVE_UNPAID_COD,
        ]),
      });
    });
  });

  describe('ensurePendingCodCollection', () => {
    it('uses the transaction manager repositories and locks the order before creating', async () => {
      const txOrdersRepo = {
        findOneOrFail: jest.fn().mockResolvedValue({ id: 42 }),
      };
      const txCodRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((row: Partial<CodCollection>) => row as CodCollection),
        save: jest.fn(async (row: CodCollection) => ({ id: 7, ...row })),
      };
      const manager = {
        getRepository: jest.fn((entity) =>
          entity === Order ? txOrdersRepo : txCodRepo,
        ),
      } as any;

      const result = await service.ensurePendingCodCollection(
        { orderId: 42, amountMinor: '12500', eligible: true },
        manager,
      );

      expect(txOrdersRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 42 },
        lock: { mode: 'pessimistic_write' },
      });
      expect(txCodRepo.findOne).toHaveBeenCalledWith({
        where: { orderId: 42 },
        order: { id: 'ASC' },
      });
      expect(txCodRepo.save).toHaveBeenCalled();
      expect(codRepo.findOne).not.toHaveBeenCalled();
      expect(result.id).toBe(7);
    });
  });

  describe('recordCashCollection + reconcile', () => {
    const codOrder = {
      id: 5,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      finalTotalMinor: '12000',
      codEligible: true,
      orderStatus: OrderStatus.OUT_FOR_DELIVERY,
    } as Order;

    it('records OTP/photo refs and marks cash_collected', async () => {
      ordersRepo.findOne!.mockResolvedValue({ ...codOrder });
      codRepo.findOne!.mockResolvedValue({
        id: 3,
        orderId: 5,
        status: CodCollectionStatus.PENDING,
        amountMinor: '12000',
        otpRef: null,
        photoFileId: null,
        receiptRefs: null,
        riderId: null,
      } as CodCollection);

      const saved = await service.recordCashCollection(5, {
        otpRef: 'otp-ref-abc',
        photoFileId: 99,
      });

      expect(saved.status).toBe(CodCollectionStatus.COLLECTED);
      expect(saved.otpRef).toBe('otp-ref-abc');
      expect(saved.photoFileId).toBe(99);
      expect(saved.collectedAt).toBeInstanceOf(Date);
      expect(ordersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: 'paid' }),
      );
    });

    it('requires proof refs for collection', async () => {
      ordersRepo.findOne!.mockResolvedValue({ ...codOrder });
      codRepo.findOne!.mockResolvedValue({
        id: 3,
        orderId: 5,
        status: CodCollectionStatus.PENDING,
      } as CodCollection);

      await expect(service.recordCashCollection(5, {})).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'cod_proof_required' }),
      });
    });

    it('records COD collection failure with reason', async () => {
      ordersRepo.findOne!.mockResolvedValue({ ...codOrder });
      codRepo.findOne!.mockResolvedValue({
        id: 3,
        orderId: 5,
        status: CodCollectionStatus.PENDING,
        amountMinor: '12000',
      } as CodCollection);
      codRepo.save!.mockImplementation(async (row) => row as CodCollection);

      const saved = await service.recordCashCollectionFailed(5, {
        returnReason: 'Customer has no cash',
        photoFileId: 44,
      });

      expect(saved.status).toBe(CodCollectionStatus.FAILED);
      expect(saved.returnReason).toBe('Customer has no cash');
      expect(saved.failedAt).toBeInstanceOf(Date);
      expect(saved.photoFileId).toBe(44);
      expect(ordersRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: 'paid' }),
      );
    });

    it('reconciles collected cash and clears payout hold', async () => {
      codRepo.findOne!.mockResolvedValue({
        id: 3,
        orderId: 5,
        status: CodCollectionStatus.COLLECTED,
        reconciledAt: null,
        reconciledByUserId: null,
      } as CodCollection);
      const heldPayout = {
        id: 7,
        orderId: 5,
        settlementState: PayoutSettlementState.HELD,
        holdReason: COD_PAYOUT_HOLD_REASON,
      } as Payout;
      payoutRepo.find!.mockResolvedValue([heldPayout]);

      const result = await service.reconcileCodCollection(5, 42, {});

      expect(result.status).toBe(CodCollectionStatus.RECONCILED);
      expect(result.reconciledByUserId).toBe(42);
      expect(result.reconciledAt).toBeInstanceOf(Date);
      expect(payoutRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          settlementState: PayoutSettlementState.PENDING,
          holdReason: null,
        }),
      );
    });

    it('rejects recon before collection', async () => {
      codRepo.findOne!.mockResolvedValue({
        id: 3,
        orderId: 5,
        status: CodCollectionStatus.PENDING,
      } as CodCollection);

      await expect(
        service.reconcileCodCollection(5, 1, {}),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'cod_not_collected' }),
      });
    });
  });

  describe('COD payout hold hook', () => {
    it('holds payout until COD is reconciled', async () => {
      ordersRepo.findOne!.mockResolvedValue({
        id: 5,
        paymentMethod: 'cod',
      } as Order);
      codRepo.findOne!.mockResolvedValue({
        orderId: 5,
        status: CodCollectionStatus.COLLECTED,
      } as CodCollection);
      const payout = {
        id: 1,
        orderId: 5,
        settlementState: PayoutSettlementState.PENDING,
        holdReason: null,
      } as Payout;
      payoutRepo.find!.mockResolvedValue([payout]);

      await service.applyCodPayoutHold(5);

      expect(payoutRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          settlementState: PayoutSettlementState.HELD,
          holdReason: COD_PAYOUT_HOLD_REASON,
        }),
      );
    });

    it('blocks release when COD not reconciled', async () => {
      ordersRepo.findOne!.mockResolvedValue({
        id: 5,
        paymentMethod: 'cod',
      } as Order);
      codRepo.findOne!.mockResolvedValue({
        status: CodCollectionStatus.COLLECTED,
      } as CodCollection);

      await expect(
        service.assertCodReconciledBeforePayout(5),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'cod_recon_required',
          holdReason: COD_PAYOUT_HOLD_REASON,
        }),
      });
    });

    it('allows payout after cash_reconciled', async () => {
      ordersRepo.findOne!.mockResolvedValue({
        id: 5,
        paymentMethod: 'cod',
      } as Order);
      codRepo.findOne!.mockResolvedValue({
        status: CodCollectionStatus.RECONCILED,
      } as CodCollection);

      await expect(
        service.assertCodReconciledBeforePayout(5),
      ).resolves.toBeUndefined();
    });

    it('skips hold gate for non-COD orders', async () => {
      ordersRepo.findOne!.mockResolvedValue({
        id: 5,
        paymentMethod: 'pilot_credit',
      } as Order);

      await expect(
        service.assertCodReconciledBeforePayout(5),
      ).resolves.toBeUndefined();
    });
  });
});
