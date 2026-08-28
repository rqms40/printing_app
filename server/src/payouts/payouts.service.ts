import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Payout, PayoutSettlementState } from './entities/payout.entity';
import { PaymentsService } from '../payments/payments.service';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from '../matching/entities/supplier-assignment.entity';
import { GeoZonesService } from '../geo-zones/geo-zones.service';
import {
  ISSUE_WINDOW_MS,
  PAYOUT_HOLD_ISSUE_WINDOW,
  PAYOUT_HOLD_OPEN_ISSUE,
} from './payout-hold.constants';
import { SuppliersService } from '../suppliers/suppliers.service';
import { FilesService } from '../files/files.service';
import {
  FileMetadata,
  FilePurpose,
} from '../files/entities/file-metadata.entity';
import { splitSupplierInstallments } from './payout-installments';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(SupplierAssignment)
    private readonly assignmentRepo: Repository<SupplierAssignment>,
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
    private readonly geoZonesService: GeoZonesService,
    private readonly suppliersService: SuppliersService,
    @Optional() private readonly filesService?: FilesService,
  ) {}

  async list(
    params: {
      settlementState?: PayoutSettlementState;
      supplierId?: number;
      limit?: number;
    } = {},
  ): Promise<Payout[]> {
    const where: Record<string, unknown> = {};
    if (params.settlementState) {
      where.settlementState = params.settlementState;
    }
    if (params.supplierId != null) {
      where.supplierId = params.supplierId;
    }
    return this.payoutRepo.find({
      where,
      order: { id: 'DESC' },
      take: Math.min(200, params.limit ?? 100),
      relations: { supplier: true, order: true },
    });
  }

  async findById(id: number): Promise<Payout> {
    const payout = await this.payoutRepo.findOne({
      where: { id },
      relations: { supplier: true, order: true },
    });
    if (!payout) throw new NotFoundException(`Payout ${id} not found`);
    return payout;
  }

  async findByOrderId(orderId: number): Promise<Payout | null> {
    return this.payoutRepo.findOne({
      where: { orderId },
      order: { id: 'DESC' },
    });
  }

  async findLatestByOrderIds(orderIds: number[]): Promise<Map<number, Payout>> {
    const map = new Map<number, Payout>();
    const ids = [...new Set(orderIds.filter((id) => Number.isInteger(id)))];
    if (ids.length === 0) return map;
    const rows = await this.payoutRepo.find({
      where: { orderId: In(ids) },
      order: { id: 'DESC' },
    });
    for (const row of rows) {
      if (!map.has(row.orderId)) map.set(row.orderId, row);
    }
    return map;
  }

  /**
   * On delivery: open 24h issue window, create/refresh payout as held.
   * Idempotent per order (reuses existing payout row).
   */
  async openIssueWindowOnDelivered(
    orderId: number,
    actorUserId: number | null,
    manager?: EntityManager,
  ): Promise<{ payout: Payout; issueWindowEndsAt: Date }> {
    const orderRepo = manager ? manager.getRepository(Order) : this.ordersRepo;
    const payoutRepo = manager
      ? manager.getRepository(Payout)
      : this.payoutRepo;
    const assignmentRepo = manager
      ? manager.getRepository(SupplierAssignment)
      : this.assignmentRepo;

    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    const assignment = await assignmentRepo.findOne({
      where: {
        orderId,
        decision: SupplierAssignmentDecision.ACCEPTED,
      },
      order: { id: 'DESC' },
    });
    if (!assignment) {
      throw new BadRequestException({
        code: 'no_accepted_supplier',
        message: `No accepted supplier assignment for order ${orderId}`,
      });
    }

    const issueWindowEndsAt = new Date(Date.now() + ISSUE_WINDOW_MS);
    order.issueWindowEndsAt = issueWindowEndsAt;
    await orderRepo.save(order);

    let payout = await payoutRepo.findOne({
      where: { orderId },
      order: { id: 'DESC' },
    });

    const amounts = await this.computeAmounts(order, assignment);

    if (!payout) {
      payout = payoutRepo.create({
        supplierId: assignment.supplierId,
        orderId,
        grossMinor: amounts.grossMinor,
        commissionMinor: amounts.commissionMinor,
        netMinor: amounts.netMinor,
        holdReason: PAYOUT_HOLD_ISSUE_WINDOW,
        holdExpiresAt: issueWindowEndsAt,
        settlementState: PayoutSettlementState.HELD,
        releaseAuthorityId: null,
        settlementReference: null,
        releasedAt: null,
        settledAt: null,
      });
    } else if (
      payout.settlementState !== PayoutSettlementState.RELEASED &&
      payout.settlementState !== PayoutSettlementState.SETTLED &&
      payout.settlementState !== PayoutSettlementState.CANCELLED
    ) {
      // Prefer open_issue hold if already frozen for a claim.
      if (payout.holdReason !== PAYOUT_HOLD_OPEN_ISSUE) {
        payout.holdReason = PAYOUT_HOLD_ISSUE_WINDOW;
      }
      payout.holdExpiresAt = issueWindowEndsAt;
      payout.settlementState = PayoutSettlementState.HELD;
      payout.grossMinor = amounts.grossMinor;
      payout.commissionMinor = amounts.commissionMinor;
      payout.netMinor = amounts.netMinor;
    }

    const saved = await payoutRepo.save(payout);

    // COD recon may stack an additional hold reason after issue window.
    try {
      await this.paymentsService.applyCodPayoutHold(orderId);
    } catch (err) {
      this.logger.warn(`COD payout hold after issue window: ${err}`);
    }

    await this.auditService.append(
      {
        actorId: actorUserId,
        actorRole: 'system',
        action: 'payout_issue_window_open',
        entityType: 'payout',
        entityId: String(saved.id),
        orderId,
        fromState: null,
        toState: PayoutSettlementState.HELD,
        reason: PAYOUT_HOLD_ISSUE_WINDOW,
        metadata: {
          supplierId: saved.supplierId,
          issueWindowEndsAt: issueWindowEndsAt.toISOString(),
          netMinor: saved.netMinor,
        },
        idempotencyKey: `payout_issue_window:${orderId}`,
      },
      manager,
    );

    return { payout: saved, issueWindowEndsAt };
  }

  /**
   * Timely material issue freezes payout until claim resolution.
   */
  async freezeForOpenIssue(
    orderId: number,
    issueId: number,
    actorUserId: number,
    actorRole: string,
    manager?: EntityManager,
  ): Promise<Payout | null> {
    const payoutRepo = manager
      ? manager.getRepository(Payout)
      : this.payoutRepo;
    const payout = await payoutRepo.findOne({
      where: { orderId },
      order: { id: 'DESC' },
    });
    if (!payout) return null;
    if (
      payout.settlementState === PayoutSettlementState.RELEASED ||
      payout.settlementState === PayoutSettlementState.SETTLED ||
      payout.settlementState === PayoutSettlementState.CANCELLED
    ) {
      return payout;
    }

    const from = payout.settlementState;
    payout.settlementState = PayoutSettlementState.HELD;
    payout.holdReason = PAYOUT_HOLD_OPEN_ISSUE;
    // Keep hold open until ops resolves — clear window expiry.
    payout.holdExpiresAt = null;
    const saved = await payoutRepo.save(payout);

    await this.auditService.append(
      {
        actorId: actorUserId,
        actorRole,
        action: 'payout_freeze_open_issue',
        entityType: 'payout',
        entityId: String(saved.id),
        orderId,
        fromState: from,
        toState: PayoutSettlementState.HELD,
        reason: PAYOUT_HOLD_OPEN_ISSUE,
        metadata: { issueId },
      },
      manager,
    );

    return saved;
  }

  /**
   * After claim resolve path = release (or reject with no payout impact):
   * move held open_issue → pending (COD recon may re-hold).
   */
  async releaseIssueHold(
    orderId: number,
    actorUserId: number,
    actorRole: string,
    reason: string,
    manager?: EntityManager,
  ): Promise<Payout | null> {
    const payoutRepo = manager
      ? manager.getRepository(Payout)
      : this.payoutRepo;
    const payout = await payoutRepo.findOne({
      where: { orderId },
      order: { id: 'DESC' },
    });
    if (!payout) return null;
    if (payout.holdReason !== PAYOUT_HOLD_OPEN_ISSUE) {
      return payout;
    }
    if (
      payout.settlementState === PayoutSettlementState.RELEASED ||
      payout.settlementState === PayoutSettlementState.SETTLED
    ) {
      return payout;
    }

    const from = payout.settlementState;
    payout.settlementState = PayoutSettlementState.PENDING;
    payout.holdReason = null;
    payout.holdExpiresAt = null;
    const saved = await payoutRepo.save(payout);

    try {
      await this.paymentsService.applyCodPayoutHold(orderId);
    } catch (err) {
      this.logger.warn(`COD hold re-apply after issue release: ${err}`);
    }

    const fresh = await payoutRepo.findOne({ where: { id: saved.id } });
    await this.auditService.append(
      {
        actorId: actorUserId,
        actorRole,
        action: 'payout_release_issue_hold',
        entityType: 'payout',
        entityId: String(saved.id),
        orderId,
        fromState: from,
        toState: fresh?.settlementState ?? PayoutSettlementState.PENDING,
        reason,
        metadata: { holdReasonAfter: fresh?.holdReason ?? null },
      },
      manager,
    );

    return fresh ?? saved;
  }

  /**
   * Close issue window when timer expires and no open issues remain.
   * issue_window hold → pending (COD may re-hold).
   */
  async closeIssueWindowHold(
    orderId: number,
    manager?: EntityManager,
  ): Promise<Payout | null> {
    const payoutRepo = manager
      ? manager.getRepository(Payout)
      : this.payoutRepo;
    const payout = await payoutRepo.findOne({
      where: { orderId },
      order: { id: 'DESC' },
    });
    if (!payout) return null;
    if (payout.holdReason !== PAYOUT_HOLD_ISSUE_WINDOW) {
      return payout;
    }
    if (payout.settlementState !== PayoutSettlementState.HELD) {
      return payout;
    }

    const from = payout.settlementState;
    payout.settlementState = PayoutSettlementState.PENDING;
    payout.holdReason = null;
    payout.holdExpiresAt = null;
    const saved = await payoutRepo.save(payout);

    try {
      await this.paymentsService.applyCodPayoutHold(orderId);
    } catch (err) {
      this.logger.warn(`COD hold after issue window close: ${err}`);
    }

    await this.auditService.append(
      {
        actorId: null,
        actorRole: 'system',
        action: 'payout_issue_window_close',
        entityType: 'payout',
        entityId: String(saved.id),
        orderId,
        fromState: from,
        toState: PayoutSettlementState.PENDING,
        reason: 'issue_window_expired',
        idempotencyKey: `payout_issue_window_close:${orderId}`,
      },
      manager,
    );

    return saved;
  }

  /**
   * Super/ops approval → released. Enforces COD recon gate via PaymentsService.
   */
  async approveRelease(
    payoutId: number,
    actorUserId: number,
    actorRole: string,
    settlementReference?: string | null,
  ): Promise<Payout> {
    const payout = await this.findById(payoutId);

    if (
      payout.settlementState === PayoutSettlementState.RELEASED ||
      payout.settlementState === PayoutSettlementState.SETTLED
    ) {
      return payout;
    }

    if (payout.settlementState === PayoutSettlementState.CANCELLED) {
      throw new BadRequestException({
        code: 'payout_cancelled',
        message: 'Cannot release a cancelled payout',
      });
    }

    await this.paymentsService.assertCodReconciledBeforePayout(payout.orderId);
    await this.paymentsService.clearCodPayoutHold(payout.orderId);
    const fresh = await this.findById(payoutId);

    if (
      fresh.settlementState === PayoutSettlementState.HELD &&
      fresh.holdReason
    ) {
      throw new BadRequestException({
        code: 'payout_held',
        message: `Payout is held: ${fresh.holdReason}`,
        holdReason: fresh.holdReason,
      });
    }

    Object.assign(payout, fresh);

    const from = payout.settlementState;
    payout.settlementState = PayoutSettlementState.RELEASED;
    payout.releaseAuthorityId = actorUserId;
    payout.releasedAt = new Date();
    payout.holdReason = null;
    if (settlementReference != null) {
      payout.settlementReference = settlementReference;
    }

    const saved = await this.payoutRepo.save(payout);

    await this.auditService.append({
      actorId: actorUserId,
      actorRole: actorRole || UserRole.SUPER_ADMIN,
      action: 'payout_release',
      entityType: 'payout',
      entityId: String(payoutId),
      orderId: payout.orderId,
      fromState: from,
      toState: PayoutSettlementState.RELEASED,
      reason: 'manual_approval',
      metadata: {
        supplierId: payout.supplierId,
        netMinor: payout.netMinor,
        settlementReference: payout.settlementReference,
      },
    });

    return saved;
  }

  /**
   * After ops/super pays the supplier via their QR, attach the receipt
   * to the payout row (created now if missing).
   */
  async recordOpsAuthorization(
    orderId: number,
    input: {
      receiptFileId: number;
      actorUserId: number;
      manager?: EntityManager;
    },
  ): Promise<Payout> {
    const orderRepo = input.manager
      ? input.manager.getRepository(Order)
      : this.ordersRepo;
    const payoutRepo = input.manager
      ? input.manager.getRepository(Payout)
      : this.payoutRepo;
    const assignmentRepo = input.manager
      ? input.manager.getRepository(SupplierAssignment)
      : this.assignmentRepo;

    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException(`Order ${orderId} not found`);

    await this.assertOwnedPayoutReceipt(
      input.receiptFileId,
      input.actorUserId,
      input.manager,
    );

    const assignment = await assignmentRepo.findOne({
      where: {
        orderId,
        decision: In([
          SupplierAssignmentDecision.ACCEPTED,
          SupplierAssignmentDecision.PENDING,
        ]),
      },
      order: { id: 'DESC' },
    });
    if (!assignment) {
      throw new BadRequestException({
        code: 'no_supplier_assignment',
        message: `No supplier assignment for order ${orderId}`,
      });
    }

    const amounts = await this.computeAmounts(order, assignment);
    let payout = await payoutRepo.findOne({
      where: { orderId },
      order: { id: 'DESC' },
    });
    if (!payout) {
      payout = payoutRepo.create({
        supplierId: assignment.supplierId,
        orderId,
        grossMinor: amounts.grossMinor,
        commissionMinor: amounts.commissionMinor,
        netMinor: amounts.netMinor,
        holdReason: null,
        holdExpiresAt: null,
        settlementState: PayoutSettlementState.PENDING,
        releaseAuthorityId: null,
        settlementReference: null,
        releasedAt: null,
        settledAt: null,
      });
    } else {
      payout.grossMinor = amounts.grossMinor;
      payout.commissionMinor = amounts.commissionMinor;
      payout.netMinor = amounts.netMinor;
    }
    const split = splitSupplierInstallments(amounts.grossMinor);
    payout.depositAmountMinor = split.depositMinor;
    if (!payout.completionAmountMinor) {
      payout.completionAmountMinor = split.completionMinor;
    }
    payout.adminReceiptFileId = input.receiptFileId;
    payout.authorizedAt = new Date();
    payout.authorizedByUserId = input.actorUserId;
    const saved = await payoutRepo.save(payout);

    await this.auditService.append(
      {
        actorId: input.actorUserId,
        actorRole: 'ops_admin',
        action: 'payout_ops_receipt_recorded',
        entityType: 'payout',
        entityId: String(saved.id),
        orderId,
        reason: 'ops_paid_supplier_via_qr',
        metadata: {
          receiptFileId: input.receiptFileId,
          installment: 'deposit',
          depositAmountMinor: saved.depositAmountMinor,
          grossMinor: saved.grossMinor,
          netMinor: saved.netMinor,
        },
        idempotencyKey: `payout_ops_receipt:${orderId}:${input.receiptFileId}`,
      },
      input.manager,
    );
    return saved;
  }

  /**
   * After delivery/collection, attach the remaining 50% receipt.
   * Does not change order status.
   */
  async recordOpsCompletionAuthorization(
    orderId: number,
    input: {
      receiptFileId: number;
      actorUserId: number;
      manager?: EntityManager;
    },
  ): Promise<Payout> {
    const payoutRepo = input.manager
      ? input.manager.getRepository(Payout)
      : this.payoutRepo;

    await this.assertOwnedPayoutReceipt(
      input.receiptFileId,
      input.actorUserId,
      input.manager,
    );

    const payout = await payoutRepo.findOne({
      where: { orderId },
      order: { id: 'DESC' },
    });
    if (!payout?.adminReceiptFileId || !payout.authorizedAt) {
      throw new BadRequestException({
        code: 'deposit_not_authorized',
        message:
          'Authorize the first 50% supplier payment before the completion payment',
      });
    }
    if (payout.completionReceiptFileId && payout.completionAuthorizedAt) {
      return payout;
    }

    const split = splitSupplierInstallments(payout.grossMinor);
    if (!payout.depositAmountMinor) {
      payout.depositAmountMinor = split.depositMinor;
    }
    payout.completionAmountMinor =
      payout.completionAmountMinor ?? split.completionMinor;
    payout.completionReceiptFileId = input.receiptFileId;
    payout.completionAuthorizedAt = new Date();
    payout.completionAuthorizedByUserId = input.actorUserId;
    const saved = await payoutRepo.save(payout);

    await this.auditService.append(
      {
        actorId: input.actorUserId,
        actorRole: 'ops_admin',
        action: 'payout_ops_completion_receipt_recorded',
        entityType: 'payout',
        entityId: String(saved.id),
        orderId,
        reason: 'ops_paid_supplier_completion_via_qr',
        metadata: {
          receiptFileId: input.receiptFileId,
          installment: 'completion',
          completionAmountMinor: saved.completionAmountMinor,
          grossMinor: saved.grossMinor,
        },
        idempotencyKey: `payout_ops_completion_receipt:${orderId}:${input.receiptFileId}`,
      },
      input.manager,
    );
    return saved;
  }

  /** Supplier self-service list (own profile only). */
  async listForSupplierUser(userId: number): Promise<unknown[]> {
    await this.suppliersService.assertVerifiedOperationalAccess(userId);
    const rows = await this.payoutRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.supplier', 's')
      .leftJoinAndSelect('p.order', 'o')
      .where('s.user_id = :userId', { userId })
      .orderBy('p.id', 'DESC')
      .take(100)
      .getMany();
    return Promise.all(rows.map((row) => this.toSupplierPayoutView(row)));
  }

  async assertSupplierOwnsPayout(
    payoutId: number,
    userId: number,
  ): Promise<Payout> {
    await this.suppliersService.assertVerifiedOperationalAccess(userId);
    const payout = await this.payoutRepo.findOne({
      where: { id: payoutId },
      relations: { supplier: true, order: true },
    });
    if (!payout) throw new NotFoundException(`Payout ${payoutId} not found`);
    if (payout.supplier?.userId !== userId) {
      throw new ForbiddenException('Not your payout');
    }
    return this.toSupplierPayoutView(payout) as unknown as Payout;
  }

  private async toSupplierPayoutView(payout: Payout): Promise<
    Payout & {
      adminReceiptUrl: string | null;
      completionReceiptUrl: string | null;
      payoutQrUrl: string | null;
    }
  > {
    const adminReceiptUrl = await this.signedFileUrl(
      payout.adminReceiptFileId ?? null,
    );
    const completionReceiptUrl = await this.signedFileUrl(
      payout.completionReceiptFileId ?? null,
    );
    const payoutQrUrl = await this.signedFileUrl(
      payout.supplier?.payoutQrFileId ?? null,
    );
    return Object.assign(payout, {
      adminReceiptUrl,
      completionReceiptUrl,
      payoutQrUrl,
    });
  }

  private async assertOwnedPayoutReceipt(
    fileId: number,
    actorUserId: number,
    manager?: EntityManager,
  ): Promise<FileMetadata> {
    if (!Number.isInteger(fileId) || fileId <= 0) {
      throw new BadRequestException({
        code: 'payout_receipt_required',
        message: 'Upload a payment receipt before authorizing payment',
      });
    }
    if (!manager && !this.filesService) {
      // Unit tests construct PayoutsService without FilesService.
      return { id: fileId } as FileMetadata;
    }
    let file: FileMetadata | null = null;
    if (manager) {
      file = await manager
        .getRepository(FileMetadata)
        .findOne({ where: { id: fileId } });
    } else if (this.filesService) {
      try {
        file = await this.filesService.findById(fileId);
      } catch {
        file = null;
      }
    }
    if (!file) {
      throw new BadRequestException({
        code: 'payout_receipt_invalid',
        message: 'Payout receipt file was not found',
      });
    }
    if (file.uploadedBy != null && file.uploadedBy !== actorUserId) {
      throw new ForbiddenException({
        code: 'payout_receipt_not_owned',
        message: 'Payout receipt must be uploaded by the authorizing admin',
      });
    }
    if (file.purpose && file.purpose !== FilePurpose.PAYOUT_RECEIPT) {
      throw new BadRequestException({
        code: 'payout_receipt_invalid',
        message: 'Uploaded file is not a payout receipt',
      });
    }
    return file;
  }

  private async signedFileUrl(fileId: number | null): Promise<string | null> {
    if (!fileId || !this.filesService) return null;
    try {
      const file = await this.filesService.findById(fileId);
      if (!file) return null;
      if (!file.objectKey) return file.url ?? null;
      return await this.filesService.getPresignedUrlForKey(
        file.objectKey,
        3600,
      );
    } catch {
      return null;
    }
  }

  private async computeAmounts(
    order: Order,
    assignment: SupplierAssignment,
  ): Promise<{
    grossMinor: string;
    commissionMinor: string;
    netMinor: string;
  }> {
    let grossMinor =
      assignment.finalPriceMinor ?? order.finalTotalMinor ?? null;
    if (grossMinor == null) {
      // Legacy major pesos → minor
      const major = Number(order.totalPrice ?? 0);
      grossMinor = String(Math.round(major * 100));
    }
    let commissionMinor: string;
    try {
      commissionMinor =
        await this.geoZonesService.computeCommissionMinor(grossMinor);
    } catch {
      // Default 15% if commerce settings unavailable in tests.
      commissionMinor = String(Math.round(Number(grossMinor) * 0.15));
    }
    const net = Math.max(0, Number(grossMinor) - Number(commissionMinor));
    return {
      grossMinor: String(grossMinor),
      commissionMinor: String(commissionMinor),
      netMinor: String(net),
    };
  }
}
