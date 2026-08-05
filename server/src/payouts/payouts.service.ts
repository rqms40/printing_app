import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout, PayoutSettlementState } from './entities/payout.entity';
import { PaymentsService } from '../payments/payments.service';
import { AuditService } from '../audit/audit.service';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class PayoutsService {
  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
  ) {}

  async list(params: {
    settlementState?: PayoutSettlementState;
    supplierId?: number;
    limit?: number;
  } = {}): Promise<Payout[]> {
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

    // Blocks when COD cash not reconciled.
    await this.paymentsService.assertCodReconciledBeforePayout(payout.orderId);
    // Clear stale COD recon holds once recon gate passes.
    await this.paymentsService.clearCodPayoutHold(payout.orderId);
    const fresh = await this.findById(payoutId);

    // Other hold reasons still block (open issue, manual hold, etc.).
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

    // Continue with reloaded row after possible COD hold clear.
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

}
