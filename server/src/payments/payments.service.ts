import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import {
  CodCollection,
  CodCollectionStatus,
} from './entities/cod-collection.entity';
import {
  QrPaymentReceipt,
  QrPaymentReceiptStatus,
} from './entities/qr-payment-receipt.entity';
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
import { isQrPhInstapayPaymentMethod } from './qr-ph-instapay';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { BatchOrder } from '../orders/entities/batch-order.entity';
import { User } from '../users/entities/user.entity';
import {
  Payout,
  PayoutSettlementState,
} from '../payouts/entities/payout.entity';
import {
  FileMetadata,
  FilePurpose,
} from '../files/entities/file-metadata.entity';
import { FilesService } from '../files/files.service';

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
    @InjectRepository(QrPaymentReceipt)
    private qrReceiptRepo: Repository<QrPaymentReceipt>,
    @InjectRepository(Order)
    private ordersRepo: Repository<Order>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Payout)
    private payoutRepo: Repository<Payout>,
    @InjectRepository(FileMetadata)
    private fileRepo: Repository<FileMetadata>,
    private readonly filesService: FilesService,
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
    const raw = (this.config.get<string>('PAYMONGO_LIVE_ENABLED') ?? 'false')
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

  // ---------------------------------------------------------------------------
  // QR Ph (Instapay) receipt verification
  // ---------------------------------------------------------------------------

  /**
   * Validate a customer-owned payment receipt file before order create.
   */
  async assertOwnedPaymentReceiptFile(
    fileId: number,
    userId: number,
  ): Promise<FileMetadata> {
    if (!Number.isInteger(fileId) || fileId <= 0) {
      throw new BadRequestException({
        code: 'qr_receipt_required',
        message: 'QR Ph (Instapay) requires a digital payment receipt upload',
      });
    }
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file || file.uploadedBy !== userId) {
      throw new BadRequestException({
        code: 'qr_receipt_invalid',
        message: 'Payment receipt file is invalid or does not belong to you',
      });
    }
    if (file.purpose !== FilePurpose.PAYMENT_RECEIPT) {
      throw new BadRequestException({
        code: 'qr_receipt_invalid',
        message: 'Uploaded file is not a payment receipt',
      });
    }
    return file;
  }

  /**
   * Attach a pending QR receipt to a newly created order (same transaction).
   */
  async createPendingQrReceipt(
    input: {
      orderId: number;
      batchOrderId?: number | null;
      userId: number;
      fileId: number;
    },
    manager?: EntityManager,
  ): Promise<QrPaymentReceipt> {
    const repo = manager
      ? manager.getRepository(QrPaymentReceipt)
      : this.qrReceiptRepo;
    const receipt = repo.create({
      orderId: input.orderId,
      batchOrderId: input.batchOrderId ?? null,
      userId: input.userId,
      fileId: input.fileId,
      status: QrPaymentReceiptStatus.PENDING,
      verifiedByUserId: null,
      verifiedAt: null,
      rejectionReason: null,
    });
    return repo.save(receipt);
  }

  async getPendingQrReceiptCount(): Promise<number> {
    return this.qrReceiptRepo.count({
      where: { status: QrPaymentReceiptStatus.PENDING },
    });
  }

  async listQrPaymentReceipts(status?: string): Promise<
    Array<{
      id: number;
      orderId: number;
      orderRef: string | null;
      batchOrderId: number | null;
      userId: number;
      userEmail: string | null;
      userName: string | null;
      fileId: number;
      receiptUrl: string | null;
      receiptFileName: string | null;
      status: QrPaymentReceiptStatus;
      paymentMethod: string | null;
      paymentStatus: string | null;
      orderTotal: number | null;
      rejectionReason: string | null;
      verifiedByUserId: number | null;
      verifiedAt: Date | null;
      createdAt: Date;
    }>
  > {
    const allowed = new Set(['pending', 'verified', 'rejected']);
    const normalized =
      status && allowed.has(status.toLowerCase())
        ? (status.toLowerCase() as QrPaymentReceiptStatus)
        : undefined;

    const qb = this.qrReceiptRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.order', 'o')
      .leftJoinAndSelect('r.user', 'u')
      .leftJoinAndSelect('r.file', 'f')
      .orderBy('r.createdAt', 'DESC')
      .take(200);

    if (normalized) {
      qb.andWhere('r.status = :status', { status: normalized });
    }

    const rows = await qb.getMany();
    return Promise.all(
      rows.map(async (r) => {
        let receiptUrl = r.file?.url ?? null;
        if (r.file?.objectKey) {
          try {
            receiptUrl = await this.filesService.getPresignedUrlForKey(
              r.file.objectKey,
              3600 * 24, // 24 hours
            ) || receiptUrl;
          } catch {
            // fallback to direct url if signing fails
          }
        }

        return {
          id: r.id,
          orderId: r.orderId,
          orderRef: r.order?.orderId ?? null,
          batchOrderId: r.batchOrderId,
          userId: r.userId,
          userEmail: r.user?.email ?? null,
          userName: r.user?.fullName ?? r.user?.nickname ?? null,
          fileId: r.fileId,
          receiptUrl,
          receiptFileName: r.file?.originalName ?? null,
          status: r.status,
          paymentMethod: r.order?.paymentMethod ?? null,
          paymentStatus: r.order?.paymentStatus ?? null,
          orderTotal:
            r.order?.totalPrice != null
              ? Number(r.order.totalPrice) + Number(r.order.deliveryFee ?? 0)
              : null,
          rejectionReason: r.rejectionReason,
          verifiedByUserId: r.verifiedByUserId,
          verifiedAt: r.verifiedAt,
          createdAt: r.createdAt,
        };
      }),
    );
  }

  /**
   * Ops verifies QR receipt → marks order (and batch) payment_status paid.
   * Production still requires authorizePayment separately.
   */
  async verifyQrPaymentReceipt(
    receiptId: number,
    actorUserId: number,
  ): Promise<QrPaymentReceipt> {
    if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
      throw new BadRequestException('Verifier is required');
    }

    return this.ordersRepo.manager.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(QrPaymentReceipt);
      const ordersRepo = manager.getRepository(Order);
      const batchRepo = manager.getRepository(BatchOrder);

      const receipt = await receiptRepo.findOne({
        where: { id: receiptId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!receipt) {
        throw new NotFoundException(`QR payment receipt ${receiptId} not found`);
      }
      if (receipt.status === QrPaymentReceiptStatus.VERIFIED) {
        return receipt;
      }
      if (receipt.status === QrPaymentReceiptStatus.REJECTED) {
        throw new BadRequestException({
          code: 'qr_receipt_already_rejected',
          message: 'Rejected receipts cannot be verified. Ask the customer to re-order.',
        });
      }

      const order = await ordersRepo.findOne({
        where: { id: receipt.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        throw new NotFoundException(`Order ${receipt.orderId} not found`);
      }
      if (!isQrPhInstapayPaymentMethod(order.paymentMethod)) {
        throw new BadRequestException({
          code: 'not_qr_payment_order',
          message: 'Order is not a QR Ph (Instapay) payment',
        });
      }

      receipt.status = QrPaymentReceiptStatus.VERIFIED;
      receipt.verifiedByUserId = actorUserId;
      receipt.verifiedAt = new Date();
      receipt.rejectionReason = null;
      await receiptRepo.save(receipt);

      order.paymentStatus = 'paid';
      await ordersRepo.save(order);

      if (order.batchOrderId) {
        const batch = await batchRepo.findOne({
          where: { id: order.batchOrderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (batch) {
          batch.paymentStatus = 'paid';
          await batchRepo.save(batch);
        }
      }

      return receipt;
    });
  }

  async rejectQrPaymentReceipt(
    receiptId: number,
    actorUserId: number,
    reason?: string,
  ): Promise<QrPaymentReceipt> {
    if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
      throw new BadRequestException('Actor is required');
    }

    return this.ordersRepo.manager.transaction(async (manager) => {
      const receiptRepo = manager.getRepository(QrPaymentReceipt);
      const ordersRepo = manager.getRepository(Order);
      const batchRepo = manager.getRepository(BatchOrder);

      const receipt = await receiptRepo.findOne({
        where: { id: receiptId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!receipt) {
        throw new NotFoundException(`QR payment receipt ${receiptId} not found`);
      }
      if (receipt.status === QrPaymentReceiptStatus.VERIFIED) {
        throw new BadRequestException({
          code: 'qr_receipt_already_verified',
          message: 'Verified receipts cannot be rejected',
        });
      }
      if (receipt.status === QrPaymentReceiptStatus.REJECTED) {
        return receipt;
      }

      const order = await ordersRepo.findOne({
        where: { id: receipt.orderId },
        lock: { mode: 'pessimistic_write' },
      });

      receipt.status = QrPaymentReceiptStatus.REJECTED;
      receipt.verifiedByUserId = actorUserId;
      receipt.verifiedAt = new Date();
      receipt.rejectionReason = reason?.trim() || 'Receipt rejected by ops';
      await receiptRepo.save(receipt);

      if (order && isQrPhInstapayPaymentMethod(order.paymentMethod)) {
        order.paymentStatus = 'failed';
        await ordersRepo.save(order);
        if (order.batchOrderId) {
          const batch = await batchRepo.findOne({
            where: { id: order.batchOrderId },
          });
          if (batch) {
            batch.paymentStatus = 'failed';
            await batchRepo.save(batch);
          }
        }
      }

      return receipt;
    });
  }

  /**
   * Whether QR payment is verified (paid) for production authorization.
   */
  async assertQrPaymentVerifiedForAuthorization(order: Order): Promise<void> {
    if (!isQrPhInstapayPaymentMethod(order.paymentMethod)) {
      return;
    }
    const receipt = await this.qrReceiptRepo.findOne({
      where: { orderId: order.id },
      order: { id: 'ASC' },
    });
    if (!receipt || receipt.status !== QrPaymentReceiptStatus.VERIFIED) {
      throw new BadRequestException({
        code: 'qr_payment_not_verified',
        message:
          'QR Ph (Instapay) payment receipt must be verified in QR Payments before authorizing production',
      });
    }
    if (String(order.paymentStatus ?? '').toLowerCase() !== 'paid') {
      throw new BadRequestException({
        code: 'qr_payment_not_verified',
        message: 'QR Ph (Instapay) payment is not marked paid yet',
      });
    }
  }
}
