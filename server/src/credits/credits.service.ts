import {
  Injectable,
  NotFoundException,
  BadRequestException,
  GoneException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  CreditTransaction,
  CreditTransactionType,
  CreditTransactionStatus,
} from './entities/credit-transaction.entity';
import { CreditSettings } from './entities/credit-settings.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FirebaseService } from '../firebase/firebase.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import {
  GrantPilotCreditsDto,
  ManualAdjustmentDto,
  UpdateSettingsDto,
} from './dto/credits.dto';
import { User } from '../users/entities/user.entity';

export interface CreditMutationResult {
  transaction: CreditTransaction;
  userId: number;
  balance: number;
  balanceChanged: boolean;
}

export interface PilotLedgerOptions {
  referenceId?: string;
  reason?: string;
  actorUserId?: number;
  expiresAt?: Date | null;
  manager?: EntityManager;
}

export interface CreditBalanceHistory {
  balance: number;
  productName: 'Pilot Credits';
  transactions: CreditTransaction[];
}

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(CreditTransaction)
    private transactionRepo: Repository<CreditTransaction>,
    @InjectRepository(CreditSettings)
    private settingsRepo: Repository<CreditSettings>,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
    private firebaseService: FirebaseService,
    private notificationsGateway: NotificationsGateway,
    private dataSource: DataSource,
  ) {}

  // ─── Pilot Credits: grant / reserve / spend / release / expire / adjust ───

  /**
   * Ops/Super Admin grant of Pilot Credits (test instrument).
   * Not purchaseable; reason required; optional expiry.
   */
  async grantPilotCredits(
    dto: GrantPilotCreditsDto,
    actorUserId: number,
  ): Promise<CreditMutationResult> {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Grant reason is required');
    }
    if (!(dto.amount > 0)) {
      throw new BadRequestException('Grant amount must be positive');
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new BadRequestException('Invalid expiresAt');
    }

    const mutation = await this.dataSource.transaction((manager) =>
      this.applyBalanceDeltaWithManager({
        userId: dto.userId,
        amountDelta: dto.amount,
        type: CreditTransactionType.GRANT,
        status: CreditTransactionStatus.APPROVED,
        referenceId: dto.referenceId ?? null,
        reason: dto.reason.trim(),
        actorUserId,
        expiresAt,
        manager,
      }),
    );
    this.publishCreditMutation(mutation);

    try {
      await this.notificationsService.create({
        userId: dto.userId,
        title: 'Pilot Credits granted',
        message: `You received ${dto.amount} Pilot Credits.`,
        type: 'credit',
      });
    } catch {
      // non-critical
    }

    return mutation;
  }

  /**
   * Reserve available Pilot Credits (hold). Requires idempotency key.
   * Deducts from available balance until spend or release.
   */
  async reserveCredits(
    userId: number,
    amount: number,
    idempotencyKey: string,
    options: PilotLedgerOptions = {},
  ): Promise<CreditMutationResult> {
    this.assertPositiveAmount(amount);
    this.assertIdempotencyKey(idempotencyKey);

    const run = async (manager: EntityManager) => {
      const existing = await this.findByIdempotencyKey(
        manager,
        idempotencyKey,
      );
      if (existing) {
        return this.idempotentReplay(
          existing,
          CreditTransactionType.RESERVE,
          userId,
          amount,
          manager,
        );
      }
      return this.applyBalanceDeltaWithManager({
        userId,
        amountDelta: -amount,
        type: CreditTransactionType.RESERVE,
        status: CreditTransactionStatus.APPROVED,
        referenceId: options.referenceId ?? null,
        reason: options.reason ?? null,
        actorUserId: options.actorUserId ?? null,
        idempotencyKey,
        manager,
      });
    };

    if (options.manager) {
      return run(options.manager);
    }
    const mutation = await this.dataSource.transaction(run);
    this.publishCreditMutation(mutation);
    return mutation;
  }

  /**
   * Spend Pilot Credits. Requires idempotency key.
   * When `reserveIdempotencyKey` is provided, settles a prior reserve without
   * a second balance deduction (reserve already held funds).
   */
  async spendCredits(
    userId: number,
    amount: number,
    idempotencyKey: string,
    options: PilotLedgerOptions & { reserveIdempotencyKey?: string } = {},
  ): Promise<CreditMutationResult> {
    this.assertPositiveAmount(amount);
    this.assertIdempotencyKey(idempotencyKey);

    const run = async (manager: EntityManager) => {
      const existing = await this.findByIdempotencyKey(
        manager,
        idempotencyKey,
      );
      if (existing) {
        return this.idempotentReplay(
          existing,
          CreditTransactionType.SPEND,
          userId,
          amount,
          manager,
        );
      }

      if (options.reserveIdempotencyKey) {
        const reserve = await this.findByIdempotencyKey(
          manager,
          options.reserveIdempotencyKey,
        );
        if (!reserve) {
          throw new BadRequestException('Reserve not found for spend');
        }
        if (
          reserve.userId !== userId ||
          reserve.type !== CreditTransactionType.RESERVE ||
          reserve.status !== CreditTransactionStatus.APPROVED ||
          Number(reserve.amountCredits) !== amount
        ) {
          throw new BadRequestException(
            'Reserve ledger reference mismatch for spend',
          );
        }
        // Balance already reduced at reserve time.
        return this.applyBalanceDeltaWithManager({
          userId,
          amountDelta: 0,
          type: CreditTransactionType.SPEND,
          status: CreditTransactionStatus.APPROVED,
          referenceId: options.referenceId ?? reserve.referenceId,
          reason: options.reason ?? null,
          actorUserId: options.actorUserId ?? null,
          idempotencyKey,
          amountCreditsOverride: amount,
          manager,
        });
      }

      return this.applyBalanceDeltaWithManager({
        userId,
        amountDelta: -amount,
        type: CreditTransactionType.SPEND,
        status: CreditTransactionStatus.APPROVED,
        referenceId: options.referenceId ?? null,
        reason: options.reason ?? null,
        actorUserId: options.actorUserId ?? null,
        idempotencyKey,
        manager,
      });
    };

    if (options.manager) {
      return run(options.manager);
    }
    const mutation = await this.dataSource.transaction(run);
    this.publishCreditMutation(mutation);
    return mutation;
  }

  /**
   * Release a prior reserve back to available balance. Requires idempotency key.
   */
  async releaseCredits(
    userId: number,
    amount: number,
    idempotencyKey: string,
    options: PilotLedgerOptions & { reserveIdempotencyKey?: string } = {},
  ): Promise<CreditMutationResult> {
    this.assertPositiveAmount(amount);
    this.assertIdempotencyKey(idempotencyKey);

    const run = async (manager: EntityManager) => {
      const existing = await this.findByIdempotencyKey(
        manager,
        idempotencyKey,
      );
      if (existing) {
        return this.idempotentReplay(
          existing,
          CreditTransactionType.RELEASE,
          userId,
          amount,
          manager,
        );
      }

      if (options.reserveIdempotencyKey) {
        const reserve = await this.findByIdempotencyKey(
          manager,
          options.reserveIdempotencyKey,
        );
        if (!reserve) {
          throw new BadRequestException('Reserve not found for release');
        }
        if (
          reserve.userId !== userId ||
          reserve.type !== CreditTransactionType.RESERVE ||
          Number(reserve.amountCredits) !== amount
        ) {
          throw new BadRequestException(
            'Reserve ledger reference mismatch for release',
          );
        }
      }

      return this.applyBalanceDeltaWithManager({
        userId,
        amountDelta: amount,
        type: CreditTransactionType.RELEASE,
        status: CreditTransactionStatus.APPROVED,
        referenceId: options.referenceId ?? null,
        reason: options.reason ?? null,
        actorUserId: options.actorUserId ?? null,
        idempotencyKey,
        manager,
      });
    };

    if (options.manager) {
      return run(options.manager);
    }
    const mutation = await this.dataSource.transaction(run);
    this.publishCreditMutation(mutation);
    return mutation;
  }

  /**
   * Ops/Super Admin signed balance adjustment with audit reason.
   */
  async manualAdjustment(
    dto: ManualAdjustmentDto,
    actorUserId: number,
  ): Promise<CreditMutationResult> {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('Adjustment reason is required');
    }
    if (!Number.isFinite(dto.amount) || dto.amount === 0) {
      throw new BadRequestException('Adjustment amount must be non-zero');
    }

    const mutation = await this.dataSource.transaction((manager) =>
      this.applyBalanceDeltaWithManager({
        userId: dto.userId,
        amountDelta: dto.amount,
        type: CreditTransactionType.MANUAL_ADJUSTMENT,
        status: CreditTransactionStatus.APPROVED,
        referenceId: dto.referenceId ?? null,
        reason: dto.reason.trim(),
        actorUserId,
        amountCreditsOverride: Math.abs(dto.amount),
        manager,
      }),
    );
    this.publishCreditMutation(mutation);
    return mutation;
  }

  async getBalanceAndHistory(
    userId: number,
    limit = 50,
  ): Promise<CreditBalanceHistory> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const transactions = await this.transactionRepo.find({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: Math.min(Math.max(limit, 1), 200),
    });

    return {
      balance: Number(user.credits),
      productName: 'Pilot Credits',
      transactions,
    };
  }

  // ─── Core atomic ledger helper ────────────────────────────────────────────

  private async applyBalanceDeltaWithManager(params: {
    userId: number;
    amountDelta: number;
    type: CreditTransactionType;
    status: CreditTransactionStatus;
    referenceId?: string | null;
    reason?: string | null;
    actorUserId?: number | null;
    expiresAt?: Date | null;
    idempotencyKey?: string | null;
    amountCreditsOverride?: number;
    manager: EntityManager;
  }): Promise<CreditMutationResult> {
    const {
      userId,
      amountDelta,
      type,
      status,
      referenceId = null,
      reason = null,
      actorUserId = null,
      expiresAt = null,
      idempotencyKey = null,
      amountCreditsOverride,
      manager,
    } = params;

    const userRepo = manager.getRepository(User);
    const transactionRepo = manager.getRepository(CreditTransaction);
    const user = await userRepo.findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new NotFoundException('User not found');

    const balanceBefore = Number(user.credits);
    const balanceAfter = balanceBefore + amountDelta;
    if (balanceAfter < 0) {
      throw new BadRequestException('Insufficient Pilot Credits');
    }

    if (amountDelta !== 0) {
      user.credits = balanceAfter;
      await userRepo.save(user);
    }

    const amountCredits =
      amountCreditsOverride ?? Math.abs(amountDelta === 0 ? 0 : amountDelta);
    // For zero-delta spend settling a reserve, amountCreditsOverride is required.
    const recordedAmount =
      amountCreditsOverride != null
        ? amountCreditsOverride
        : Math.abs(amountDelta);

    const transaction = await transactionRepo.save(
      transactionRepo.create({
        userId,
        type,
        amountCredits: recordedAmount,
        status,
        referenceId,
        reason,
        actorUserId,
        expiresAt,
        idempotencyKey,
        balanceBefore,
        balanceAfter: amountDelta === 0 ? balanceBefore : balanceAfter,
      }),
    );

    return {
      transaction,
      userId: user.id,
      balance: amountDelta === 0 ? balanceBefore : balanceAfter,
      balanceChanged: amountDelta !== 0,
    };
  }

  private async findByIdempotencyKey(
    manager: EntityManager,
    idempotencyKey: string,
  ): Promise<CreditTransaction | null> {
    return manager.getRepository(CreditTransaction).findOne({
      where: { idempotencyKey },
    });
  }

  private async idempotentReplay(
    existing: CreditTransaction,
    expectedType: CreditTransactionType,
    userId: number,
    amount: number,
    manager: EntityManager,
  ): Promise<CreditMutationResult> {
    if (
      existing.userId !== userId ||
      existing.type !== expectedType ||
      existing.status !== CreditTransactionStatus.APPROVED ||
      Number(existing.amountCredits) !== amount
    ) {
      throw new BadRequestException(
        'Credit ledger idempotency key mismatch',
      );
    }
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      transaction: existing,
      userId,
      balance: Number(user.credits),
      balanceChanged: false,
    };
  }

  private assertPositiveAmount(amount: number): void {
    if (!(amount > 0) || !Number.isFinite(amount)) {
      throw new BadRequestException('Amount must be a positive number');
    }
  }

  private assertIdempotencyKey(key: string): void {
    if (!key?.trim()) {
      throw new BadRequestException(
        'Idempotency key is required for reserve/spend/release',
      );
    }
  }

  // ─── Beta enrollment (legacy TOP_UP type, retained until Phase 11) ────────

  async grantBetaEnrollmentCredits(
    userId: number,
    amount = 100,
    manager?: EntityManager,
  ): Promise<void> {
    if (manager) {
      await this.grantBetaEnrollmentCreditsWithManager(userId, amount, manager);
      return;
    }

    try {
      await this.dataSource.transaction((transactionManager) =>
        this.grantBetaEnrollmentCreditsWithManager(
          userId,
          amount,
          transactionManager,
        ),
      );
    } catch (error) {
      if (CreditsService.isUniqueViolation(error)) {
        await this.dataSource.transaction((transactionManager) =>
          this.grantBetaEnrollmentCreditsWithManager(
            userId,
            amount,
            transactionManager,
          ),
        );
        return;
      }
      throw error;
    }
  }

  private async grantBetaEnrollmentCreditsWithManager(
    userId: number,
    amount: number,
    manager: EntityManager,
  ): Promise<void> {
    const referenceId = `BETA-ENROLLMENT:${userId}`;
    const transactionRepo = manager.getRepository(CreditTransaction);
    const userRepo = manager.getRepository(User);
    const user = await userRepo.findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new NotFoundException('User not found');

    const existing = await transactionRepo.findOne({
      where: { referenceId },
    });
    if (existing) {
      if (
        existing.userId !== userId ||
        existing.type !== CreditTransactionType.TOP_UP ||
        Number(existing.amountCredits) !== amount ||
        existing.status !== CreditTransactionStatus.APPROVED
      ) {
        throw new BadRequestException(
          'Beta enrollment ledger reference mismatch',
        );
      }
      if (!user.betaCreditsGranted) {
        await userRepo.update(userId, { betaCreditsGranted: true });
      }
      return;
    }

    await transactionRepo.insert({
      userId,
      type: CreditTransactionType.TOP_UP,
      amountCredits: amount,
      status: CreditTransactionStatus.APPROVED,
      referenceId,
      reason: 'Beta enrollment grant',
    });
    if (!user.betaCreditsGranted) {
      await userRepo.increment({ id: userId }, 'credits', amount);
      await userRepo.update(userId, { betaCreditsGranted: true });
    }
  }

  private static isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error == null) return false;
    const candidate = error as {
      code?: unknown;
      constraint?: unknown;
      driverError?: { code?: unknown; constraint?: unknown };
    };
    const code = candidate.driverError?.code ?? candidate.code;
    const constraint =
      candidate.driverError?.constraint ?? candidate.constraint;
    return (
      code === '23505' &&
      constraint === 'uq_credit_transactions_beta_enrollment_reference'
    );
  }

  async getSettings(): Promise<CreditSettings> {
    let settings = await this.settingsRepo.find();
    if (settings.length === 0) {
      settings = [
        await this.settingsRepo.save(
          this.settingsRepo.create({ conversionRate: 1.0 }),
        ),
      ];
    }
    return settings[0];
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<CreditSettings> {
    const settings = await this.getSettings();
    if (dto.conversionRate !== undefined) {
      settings.conversionRate = dto.conversionRate;
    }
    if (dto.creditsOnlyMode !== undefined) {
      settings.creditsOnlyMode = dto.creditsOnlyMode;
    }
    return this.settingsRepo.save(settings);
  }

  /**
   * Client top-up is disabled for Pilot Credits (grant-only instrument).
   */
  async requestTopUp(): Promise<never> {
    throw new GoneException({
      statusCode: 410,
      message:
        'Client top-up is disabled. Pilot Credits are grant-only test credits.',
      code: 'pilot_credits_topup_disabled',
    });
  }

  async approveTopUp(transactionId: number): Promise<CreditTransaction> {
    const tx = await this.transactionRepo.findOne({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.status !== CreditTransactionStatus.PENDING) {
      throw new BadRequestException('Transaction is not pending');
    }

    const user = await this.usersService.findById(tx.userId);
    if (!user) throw new NotFoundException('User not found');

    user.credits = Number(user.credits) + Number(tx.amountCredits);
    await this.usersService.updateProfile(user.id, { credits: user.credits });

    this.notificationsService.triggerCreditsUpdate(
      user.id,
      Number(user.credits),
    );

    tx.status = CreditTransactionStatus.APPROVED;
    const savedTx = await this.transactionRepo.save(tx);

    await this.notificationsService.create({
      userId: user.id,
      title: 'Top-Up Approved',
      message: `Your top-up of ${tx.amountCredits} Credits has been approved!`,
      type: 'credit',
    });

    try {
      const fcmToken = await this.usersService.getFcmToken(user.id);
      if (fcmToken) {
        await this.firebaseService.sendToDevice(
          fcmToken,
          'Top-Up Approved! 🎉',
          `${tx.amountCredits} Credits have been added to your account.`,
          { type: 'credits_update', credits: user.credits.toString() },
        );
      }
    } catch {
      // push failure must never break the approve flow
    }

    try {
      this.notificationsGateway.notifyUserCreditsUpdate(user.id, user.credits);
    } catch {
      // non-critical
    }

    return savedTx;
  }

  async rejectTopUp(transactionId: number): Promise<CreditTransaction> {
    const tx = await this.transactionRepo.findOne({
      where: { id: transactionId },
    });
    if (!tx) throw new NotFoundException('Transaction not found');

    tx.status = CreditTransactionStatus.REJECTED;
    const saved = await this.transactionRepo.save(tx);

    try {
      await this.notificationsService.create({
        userId: tx.userId,
        title: 'Top-Up Rejected',
        message: `Your top-up request of ${tx.amountCredits} Credits was rejected.`,
        type: 'topup_rejected',
      });
      const fcmToken = await this.usersService.getFcmToken(tx.userId);
      if (fcmToken) {
        await this.firebaseService.sendToDevice(
          fcmToken,
          'Top-Up Rejected',
          `Your top-up of ${tx.amountCredits} Credits was not approved.`,
          { type: 'credits_update' },
        );
      }
    } catch {
      // notification failure must not break the reject flow
    }

    return saved;
  }

  async getPendingRequests(): Promise<CreditTransaction[]> {
    return this.transactionRepo.find({
      where: {
        status: CreditTransactionStatus.PENDING,
        type: CreditTransactionType.TOP_UP,
      },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  async getPendingCount(): Promise<number> {
    return this.transactionRepo.count({
      where: {
        status: CreditTransactionStatus.PENDING,
        type: CreditTransactionType.TOP_UP,
      },
    });
  }

  /** Legacy order debit — maps to spend-like DEDUCTION row. */
  async subtractCredits(
    userId: number,
    amountCredits: number,
    referenceId?: string,
    manager?: EntityManager,
  ): Promise<CreditMutationResult> {
    if (manager) {
      return this.subtractCreditsWithManager(
        userId,
        amountCredits,
        referenceId,
        manager,
      );
    }
    const mutation = await this.dataSource.transaction((transactionManager) =>
      this.subtractCreditsWithManager(
        userId,
        amountCredits,
        referenceId,
        transactionManager,
      ),
    );
    this.publishCreditMutation(mutation);
    return mutation;
  }

  private async subtractCreditsWithManager(
    userId: number,
    amountCredits: number,
    referenceId: string | undefined,
    manager: EntityManager,
  ): Promise<CreditMutationResult> {
    const userRepo = manager.getRepository(User);
    const transactionRepo = manager.getRepository(CreditTransaction);
    const user = await userRepo.findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new NotFoundException('User not found');
    if (Number(user.credits) < amountCredits) {
      throw new BadRequestException('Insufficient credits');
    }

    const balanceBefore = Number(user.credits);
    user.credits = balanceBefore - amountCredits;
    await userRepo.save(user);
    const transaction = await transactionRepo.save(
      transactionRepo.create({
        userId,
        type: CreditTransactionType.DEDUCTION,
        amountCredits,
        status: CreditTransactionStatus.APPROVED,
        referenceId,
        balanceBefore,
        balanceAfter: Number(user.credits),
      }),
    );
    return {
      transaction,
      userId: user.id,
      balance: Number(user.credits),
      balanceChanged: true,
    };
  }

  async refundCredits(
    userId: number,
    amountCredits: number,
    referenceId?: string,
    manager?: EntityManager,
    legacyReferenceIds: string[] = [],
  ): Promise<CreditMutationResult> {
    if (manager) {
      return this.refundCreditsWithManager(
        userId,
        amountCredits,
        referenceId,
        manager,
        legacyReferenceIds,
      );
    }
    const mutation = await this.dataSource.transaction((transactionManager) =>
      this.refundCreditsWithManager(
        userId,
        amountCredits,
        referenceId,
        transactionManager,
        legacyReferenceIds,
      ),
    );
    this.publishCreditMutation(mutation);
    return mutation;
  }

  private async refundCreditsWithManager(
    userId: number,
    amountCredits: number,
    referenceId: string | undefined,
    manager: EntityManager,
    legacyReferenceIds: string[],
  ): Promise<CreditMutationResult> {
    const userRepo = manager.getRepository(User);
    const transactionRepo = manager.getRepository(CreditTransaction);
    const user = await userRepo.findOne({
      where: { id: userId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!user) throw new NotFoundException('User not found');

    const references = [referenceId, ...legacyReferenceIds].filter(
      (reference): reference is string => Boolean(reference),
    );
    const uniqueReferences = [...new Set(references)];
    const existing =
      uniqueReferences.length === 0
        ? []
        : await transactionRepo.find({
            where: { referenceId: In(uniqueReferences) },
            order: { id: 'ASC' },
          });
    for (const transaction of existing) {
      if (
        transaction.userId !== userId ||
        transaction.type !== CreditTransactionType.TOP_UP ||
        transaction.status !== CreditTransactionStatus.APPROVED ||
        transaction.amountPhp != null ||
        transaction.proofOfPaymentUrl != null ||
        !Number.isFinite(Number(transaction.amountCredits)) ||
        Number(transaction.amountCredits) <= 0
      ) {
        throw new BadRequestException(
          'Credit refund ledger reference mismatch',
        );
      }
    }

    const existingTotal = existing.reduce(
      (sum, transaction) => sum + Number(transaction.amountCredits),
      0,
    );
    const canonical = existing.find(
      (transaction) => transaction.referenceId === referenceId,
    );
    if (
      existingTotal > amountCredits ||
      (canonical != null && existingTotal !== amountCredits)
    ) {
      throw new BadRequestException('Credit refund ledger reference mismatch');
    }
    if (existingTotal === amountCredits) {
      return {
        transaction: canonical ?? existing[0],
        userId: user.id,
        balance: Number(user.credits),
        balanceChanged: false,
      };
    }

    const remainingCredits = amountCredits - existingTotal;
    const balanceBefore = Number(user.credits);
    user.credits = balanceBefore + remainingCredits;
    await userRepo.save(user);
    const transaction = await transactionRepo.save(
      transactionRepo.create({
        userId,
        type: CreditTransactionType.TOP_UP,
        amountCredits: remainingCredits,
        status: CreditTransactionStatus.APPROVED,
        referenceId,
        balanceBefore,
        balanceAfter: Number(user.credits),
        reason: 'Order/batch refund',
      }),
    );
    return {
      transaction,
      userId: user.id,
      balance: Number(user.credits),
      balanceChanged: true,
    };
  }

  publishCreditMutation(mutation: CreditMutationResult | null): void {
    if (!mutation?.balanceChanged) return;
    this.notificationsService.triggerCreditsUpdate(
      mutation.userId,
      mutation.balance,
    );
  }
}
