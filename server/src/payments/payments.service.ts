import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import {
  CodCollection,
  CodCollectionStatus,
} from './entities/cod-collection.entity';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import {
  FailCodCollectionDto,
  RecordCodCollectionDto,
  ReconcileCodCollectionDto,
} from './dto/cod-collection.dto';
import {
  COD_PAYOUT_HOLD_REASON,
  CodEligibilityResult,
  evaluateCodEligibility,
  isCodPaymentMethod,
} from './cod-eligibility';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import {
  Payout,
  PayoutSettlementState,
} from '../payouts/entities/payout.entity';

/** Order statuses that no longer count as active unpaid COD. */
const COD_INACTIVE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.COMPLETED,
  OrderStatus.FILE_REJECTED,
];

/**
 * Truthy values for PAYMONGO_LIVE_ENABLED.
 * Default is false — live digital collection is post-pilot only.
 */
const LIVE_ENABLED_TRUTHY = new Set(['true', '1', 'yes', 'on']);

export type AssertCodCheckoutInput = {
  userId: number;
  paymentMethod: string;
  finalTotalMinor: string | number | null | undefined;
  /** Exclude this order id when checking concurrent unpaid COD. */
  excludeOrderId?: number;
  /** Optional address/zone flag; default allow (stub). */
  addressZoneEligible?: boolean;
};

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private txnRepo: Repository<PaymentTransaction>,
    @InjectRepository(CodCollection)
    private codCollectionRepo: Repository<CodCollection>,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Payout)
    private payoutRepo: Repository<Payout>,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------------------
  // PayMongo sandbox-only guard (Task 3.4)
  // Live digital collection is post-pilot. PAYMONGO_LIVE_ENABLED defaults false.
  // ---------------------------------------------------------------------------

  /**
   * Whether live PayMongo charges are explicitly unlocked.
   * Default: false (sandbox / mock only during pilot).
   */
  isPayMongoLiveEnabled(): boolean {
    const raw = (
      this.config.get<string>('PAYMONGO_LIVE_ENABLED') ?? 'false'
    )
      .toString()
      .trim()
      .toLowerCase();
    return LIVE_ENABLED_TRUTHY.has(raw);
  }

  /**
   * True when PAYMONGO_SECRET_KEY is a live key (`sk_live_...`).
   * Test keys (`sk_test_...`) and missing keys are not live.
   */
  isPayMongoLiveSecretConfigured(): boolean {
    const key = (this.config.get<string>('PAYMONGO_SECRET_KEY') ?? '').trim();
    return key.startsWith('sk_live_');
  }

  /**
   * Fail-closed: block live PayMongo charge/refund paths unless
   * PAYMONGO_LIVE_ENABLED is explicitly true (post-pilot only).
   * Sandbox (`sk_test_`) and mock checkout remain allowed.
   */
  assertPayMongoLiveChargesAllowed(operation: string): void {
    if (this.isPayMongoLiveEnabled()) {
      return;
    }
    if (!this.isPayMongoLiveSecretConfigured()) {
      return;
    }
    throw new ForbiddenException({
      code: 'paymongo_live_disabled',
      message:
        `PayMongo live charges are disabled during pilot (${operation}). ` +
        'Live digital collection is post-pilot. Set PAYMONGO_LIVE_ENABLED=true ' +
        'only after explicit pilot approval, or use sandbox (sk_test_) keys / mock checkout.',
    });
  }

  async createIntent(
    dto: CreatePaymentIntentDto,
  ): Promise<{ transaction: PaymentTransaction; checkoutUrl: string }> {
    // Block live-key charging when sandbox-only pilot guard is on.
    this.assertPayMongoLiveChargesAllowed('createIntent');

    const txn = this.txnRepo.create({
      orderId: dto.orderId,
      paymentMethod: dto.paymentMethod,
      amount: dto.amount,
      status: 'pending',
    });
    const saved = await this.txnRepo.save(txn);

    // Pilot / sandbox: mock checkout only. Real hosted checkout is post-pilot
    // (requires PAYMONGO_LIVE_ENABLED=true and a future live adapter).
    const checkoutUrl = `https://checkout.paymongo.com/mock/${saved.id}`;

    return { transaction: saved, checkoutUrl };
  }

  async confirmPayment(id: number): Promise<PaymentTransaction> {
    this.assertPayMongoLiveChargesAllowed('confirmPayment');

    const txn = await this.txnRepo.findOne({ where: { id } });
    if (!txn) throw new NotFoundException('Payment transaction not found');
    if (txn.status !== 'pending') {
      throw new BadRequestException(
        `Cannot confirm transaction with status '${txn.status}'`,
      );
    }
    txn.status = 'success';
    return this.txnRepo.save(txn);
  }

  async handleWebhook(
    payload: Record<string, any>,
  ): Promise<PaymentTransaction> {
    // Live-key webhooks that would mark real money success are blocked in pilot.
    this.assertPayMongoLiveChargesAllowed('handleWebhook');

    const data = payload?.data as Record<string, any> | undefined;
    const attributes = data?.attributes as Record<string, any> | undefined;
    const externalRefId = attributes?.reference_number as string | undefined;
    if (!externalRefId) {
      throw new BadRequestException(
        'Invalid webhook payload: missing reference_number',
      );
    }

    const txn = await this.txnRepo.findOne({
      where: { externalReferenceId: externalRefId },
    });
    if (!txn)
      throw new NotFoundException('Transaction not found for reference');

    txn.webhookPayload = payload;
    const eventType = attributes?.type as string | undefined;
    if (eventType === 'payment.paid') {
      txn.status = 'success';
    } else if (eventType === 'payment.failed') {
      txn.status = 'failed';
    }

    return this.txnRepo.save(txn);
  }

  async initiateRefund(id: number): Promise<PaymentTransaction> {
    this.assertPayMongoLiveChargesAllowed('initiateRefund');

    const txn = await this.txnRepo.findOne({ where: { id } });
    if (!txn) throw new NotFoundException('Payment transaction not found');
    if (txn.status !== 'success') {
      throw new BadRequestException('Can only refund successful transactions');
    }
    txn.status = 'refunded';
    return this.txnRepo.save(txn);
  }

  // ---------------------------------------------------------------------------
  // COD eligibility + collection + reconciliation (Task 3.2)
  // ---------------------------------------------------------------------------

  /**
   * Count other active unpaid COD orders for a client.
   * Active = payment method COD-like, payment not paid, order not terminal.
   */
  async countActiveUnpaidCodOrders(
    userId: number,
    excludeOrderId?: number,
  ): Promise<number> {
    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .where('o.userId = :userId', { userId })
      .andWhere('o.paymentStatus != :paid', { paid: 'paid' })
      .andWhere('o.orderStatus NOT IN (:...inactive)', {
        inactive: COD_INACTIVE_ORDER_STATUSES,
      })
      // COD method labels: cod, cash, cash_on_delivery (normalized in app)
      .andWhere(
        `(
          LOWER(REPLACE(REPLACE(o.paymentMethod, '_', ''), '-', '')) IN
            ('cod', 'cash', 'cashondelivery')
        )`,
      );

    if (excludeOrderId != null) {
      qb.andWhere('o.id != :excludeOrderId', { excludeOrderId });
    }

    return qb.getCount();
  }

  /**
   * Evaluate COD eligibility for a user + commercial total.
   * Does not throw — callers decide whether to reject.
   */
  async evaluateCodEligibilityForUser(input: {
    userId: number;
    finalTotalMinor: string | number | null | undefined;
    excludeOrderId?: number;
    addressZoneEligible?: boolean;
  }): Promise<CodEligibilityResult> {
    const user = await this.usersRepo.findOne({
      where: { id: input.userId },
    });
    if (!user) {
      throw new NotFoundException(`User ${input.userId} not found`);
    }

    const activeUnpaidCodCount = await this.countActiveUnpaidCodOrders(
      input.userId,
      input.excludeOrderId,
    );

    return evaluateCodEligibility({
      pilotCodEligible: user.pilotCodEligible === true,
      opsRiskBlocked: user.codOpsRiskBlocked === true,
      finalTotalMinor: input.finalTotalMinor,
      activeUnpaidCodCount,
      addressZoneEligible: input.addressZoneEligible,
    });
  }

  /**
   * Checkout/authorization gate: when payment method is COD, enforce
   * eligibility and throw ForbiddenException with structured reasons.
   * Non-COD methods pass through unchanged.
   *
   * Rejects ₱1,501+ even if the client sends `cod`.
   */
  async assertCodEligibleForCheckout(
    input: AssertCodCheckoutInput,
  ): Promise<CodEligibilityResult | null> {
    if (!isCodPaymentMethod(input.paymentMethod)) {
      return null;
    }

    const result = await this.evaluateCodEligibilityForUser({
      userId: input.userId,
      finalTotalMinor: input.finalTotalMinor,
      excludeOrderId: input.excludeOrderId,
      addressZoneEligible: input.addressZoneEligible,
    });

    if (!result.eligible) {
      throw new ForbiddenException({
        code: 'cod_not_eligible',
        message: result.message,
        reasons: result.reasons,
        maxAmountMinor: result.maxAmountMinor,
        amountMinor: result.amountMinor,
      });
    }

    return result;
  }

  /**
   * Create a pending COD collection row after eligible COD checkout.
   * Idempotent per order: returns existing row if present.
   */
  async ensurePendingCodCollection(input: {
    orderId: number;
    amountMinor: string;
    eligible: boolean;
    eligibilityReason?: string | null;
    riderId?: number | null;
  }): Promise<CodCollection> {
    const existing = await this.codCollectionRepo.findOne({
      where: { orderId: input.orderId },
      order: { id: 'ASC' },
    });
    if (existing) {
      return existing;
    }

    const row = this.codCollectionRepo.create({
      orderId: input.orderId,
      riderId: input.riderId ?? null,
      eligible: input.eligible,
      eligibilityReason: input.eligibilityReason ?? null,
      amountMinor: input.amountMinor,
      status: CodCollectionStatus.PENDING,
      otpRef: null,
      photoFileId: null,
      receiptRefs: null,
      collectedAt: null,
      failedAt: null,
      reconciledAt: null,
      reconciledByUserId: null,
      discrepancyReason: null,
      returnReason: null,
    });
    return this.codCollectionRepo.save(row);
  }

  /**
   * Delivery collection: record OTP/photo refs and mark cash_collected
   * (CodCollectionStatus.COLLECTED). Marks order payment_status paid.
   * Applies COD recon payout hold if a payout row exists.
   */
  async recordCashCollection(
    orderId: number,
    dto: RecordCodCollectionDto,
  ): Promise<CodCollection> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (!isCodPaymentMethod(order.paymentMethod)) {
      throw new BadRequestException({
        code: 'not_cod_order',
        message: 'Order payment method is not COD',
      });
    }

    let collection = await this.codCollectionRepo.findOne({
      where: { orderId },
      order: { id: 'ASC' },
    });

    if (!collection) {
      const amount =
        order.finalTotalMinor != null && order.finalTotalMinor !== ''
          ? order.finalTotalMinor
          : '0';
      collection = await this.ensurePendingCodCollection({
        orderId,
        amountMinor: amount,
        eligible: order.codEligible === true,
        eligibilityReason: null,
        riderId: dto.riderId ?? null,
      });
    }

    if (collection.status === CodCollectionStatus.RECONCILED) {
      throw new BadRequestException({
        code: 'cod_already_reconciled',
        message: 'COD collection is already reconciled',
      });
    }
    if (collection.status === CodCollectionStatus.COLLECTED) {
      throw new BadRequestException({
        code: 'cod_already_collected',
        message: 'COD cash already collected for this order',
      });
    }

    const hasProof =
      (dto.otpRef != null && dto.otpRef.trim() !== '') ||
      dto.photoFileId != null ||
      (dto.receiptRefs != null && Object.keys(dto.receiptRefs).length > 0);
    if (!hasProof) {
      throw new BadRequestException({
        code: 'cod_proof_required',
        message: 'COD collection requires otpRef, photoFileId, or receiptRefs',
      });
    }

    collection.status = CodCollectionStatus.COLLECTED;
    collection.otpRef = dto.otpRef?.trim() || collection.otpRef;
    collection.photoFileId =
      dto.photoFileId != null ? dto.photoFileId : collection.photoFileId;
    collection.receiptRefs = dto.receiptRefs ?? collection.receiptRefs;
    if (dto.riderId != null) {
      collection.riderId = dto.riderId;
    }
    collection.collectedAt = new Date();
    collection.failedAt = null;

    const saved = await this.codCollectionRepo.save(collection);

    // Cash in hand ≠ reconciliation; still mark order paid for concurrency.
    if (order.paymentStatus !== 'paid') {
      order.paymentStatus = 'paid';
      await this.ordersRepo.save(order);
    }

    await this.applyCodPayoutHold(orderId);
    return saved;
  }

  /**
   * Mark COD cash collection failed (customer could not pay / refused).
   * Does not mark order paid. Evidence optional but recommended.
   */
  async recordCashCollectionFailed(
    orderId: number,
    dto: FailCodCollectionDto,
  ): Promise<CodCollection> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order ${orderId} not found`);
    }
    if (!isCodPaymentMethod(order.paymentMethod)) {
      throw new BadRequestException({
        code: 'not_cod_order',
        message: 'Order payment method is not COD',
      });
    }

    let collection = await this.codCollectionRepo.findOne({
      where: { orderId },
      order: { id: 'ASC' },
    });

    if (!collection) {
      const amount =
        order.finalTotalMinor != null && order.finalTotalMinor !== ''
          ? order.finalTotalMinor
          : '0';
      collection = await this.ensurePendingCodCollection({
        orderId,
        amountMinor: amount,
        eligible: order.codEligible === true,
        eligibilityReason: null,
        riderId: dto.riderId ?? null,
      });
    }

    if (collection.status === CodCollectionStatus.RECONCILED) {
      throw new BadRequestException({
        code: 'cod_already_reconciled',
        message: 'COD collection is already reconciled',
      });
    }
    if (collection.status === CodCollectionStatus.COLLECTED) {
      throw new BadRequestException({
        code: 'cod_already_collected',
        message: 'COD cash already collected for this order',
      });
    }

    const reason = dto.returnReason?.trim() ?? '';
    if (!reason) {
      throw new BadRequestException({
        code: 'cod_fail_reason_required',
        message: 'COD failure requires returnReason',
      });
    }

    collection.status = CodCollectionStatus.FAILED;
    collection.returnReason = reason;
    collection.failedAt = new Date();
    collection.collectedAt = null;
    if (dto.photoFileId != null) {
      collection.photoFileId = dto.photoFileId;
    }
    if (dto.receiptRefs != null) {
      collection.receiptRefs = dto.receiptRefs;
    }
    if (dto.riderId != null) {
      collection.riderId = dto.riderId;
    }

    return this.codCollectionRepo.save(collection);
  }

  /**
   * Ops/Super Admin recon → cash_reconciled (CodCollectionStatus.RECONCILED).
   * Clears COD recon payout hold so supplier settlement can proceed.
   */
  async reconcileCodCollection(
    orderId: number,
    actorUserId: number,
    dto: ReconcileCodCollectionDto = {},
  ): Promise<CodCollection> {
    const collection = await this.codCollectionRepo.findOne({
      where: { orderId },
      order: { id: 'ASC' },
    });
    if (!collection) {
      throw new NotFoundException({
        code: 'cod_collection_not_found',
        message: `No COD collection for order ${orderId}`,
      });
    }

    if (collection.status === CodCollectionStatus.RECONCILED) {
      return collection;
    }

    if (collection.status !== CodCollectionStatus.COLLECTED) {
      throw new BadRequestException({
        code: 'cod_not_collected',
        message:
          'COD must be cash_collected before reconciliation (status collected)',
      });
    }

    collection.status = CodCollectionStatus.RECONCILED;
    collection.reconciledAt = new Date();
    collection.reconciledByUserId = actorUserId;
    if (dto.discrepancyReason != null) {
      collection.discrepancyReason = dto.discrepancyReason;
    }

    const saved = await this.codCollectionRepo.save(collection);
    await this.clearCodPayoutHold(orderId);
    return saved;
  }

  async getCodCollectionByOrder(
    orderId: number,
  ): Promise<CodCollection | null> {
    return this.codCollectionRepo.findOne({
      where: { orderId },
      order: { id: 'ASC' },
    });
  }

  /** Ops recon queue: list COD collections by status (default collected). */
  async listCodCollections(
    status: CodCollectionStatus = CodCollectionStatus.COLLECTED,
  ): Promise<CodCollection[]> {
    return this.codCollectionRepo.find({
      where: { status },
      order: { id: 'DESC' },
      take: 200,
      relations: { order: true },
    });
  }

  /**
   * Payout hook: when method is COD, block release until cash_reconciled.
   * Sets hold_reason = missing_cod_reconciliation and settlement_state = held
   * on any non-settled payouts for the order.
   */
  async applyCodPayoutHold(orderId: number): Promise<void> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order || !isCodPaymentMethod(order.paymentMethod)) {
      return;
    }

    const collection = await this.codCollectionRepo.findOne({
      where: { orderId },
      order: { id: 'ASC' },
    });
    if (collection?.status === CodCollectionStatus.RECONCILED) {
      return;
    }

    const payouts = await this.payoutRepo.find({ where: { orderId } });
    for (const payout of payouts) {
      if (
        payout.settlementState === PayoutSettlementState.SETTLED ||
        payout.settlementState === PayoutSettlementState.CANCELLED ||
        payout.settlementState === PayoutSettlementState.RELEASED
      ) {
        continue;
      }
      // Do not clobber issue-window / open-issue holds (Phase 9).
      if (
        payout.holdReason === 'issue_window' ||
        payout.holdReason === 'open_issue'
      ) {
        continue;
      }
      payout.settlementState = PayoutSettlementState.HELD;
      payout.holdReason = COD_PAYOUT_HOLD_REASON;
      await this.payoutRepo.save(payout);
    }
  }

  /**
   * Clear COD recon holds after cash_reconciled.
   * Only removes holds with COD_PAYOUT_HOLD_REASON (other holds stay).
   */
  async clearCodPayoutHold(orderId: number): Promise<void> {
    const payouts = await this.payoutRepo.find({ where: { orderId } });
    for (const payout of payouts) {
      if (payout.holdReason !== COD_PAYOUT_HOLD_REASON) {
        continue;
      }
      if (payout.settlementState === PayoutSettlementState.HELD) {
        payout.settlementState = PayoutSettlementState.PENDING;
      }
      payout.holdReason = null;
      await this.payoutRepo.save(payout);
    }
  }

  /**
   * Guard for payout release paths: COD orders require RECONCILED collection.
   * Call before transitioning a payout to released/settled.
   */
  async assertCodReconciledBeforePayout(orderId: number): Promise<void> {
    const order = await this.ordersRepo.findOne({ where: { id: orderId } });
    if (!order || !isCodPaymentMethod(order.paymentMethod)) {
      return;
    }

    const collection = await this.codCollectionRepo.findOne({
      where: { orderId },
      order: { id: 'ASC' },
    });

    if (!collection || collection.status !== CodCollectionStatus.RECONCILED) {
      throw new ForbiddenException({
        code: 'cod_recon_required',
        message:
          'Supplier payout is blocked until COD cash is reconciled (cash_reconciled)',
        holdReason: COD_PAYOUT_HOLD_REASON,
      });
    }
  }
}
