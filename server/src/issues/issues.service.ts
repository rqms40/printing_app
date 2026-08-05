import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
import {
  Issue,
  IssuePayoutImpact,
  IssueStatus,
} from './entities/issue.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { AuditService } from '../audit/audit.service';
import { PayoutsService } from '../payouts/payouts.service';
import { OpenIssueDto } from './dto/open-issue.dto';
import {
  IssueResolvePath,
  ResolveIssueDto,
} from './dto/resolve-issue.dto';
import { UserRole } from '../users/entities/user.entity';
import {
  assertOrderStatusTransition,
} from '../orders/order-status-transition';

const OPEN_STATUSES = [IssueStatus.OPEN, IssueStatus.UNDER_REVIEW];

@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    @InjectRepository(Issue)
    private readonly issueRepo: Repository<Issue>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(OrderStatusHistory)
    private readonly historyRepo: Repository<OrderStatusHistory>,
    private readonly payoutsService: PayoutsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async list(params: {
    status?: IssueStatus;
    orderId?: number;
    limit?: number;
  } = {}): Promise<Issue[]> {
    const where: Record<string, unknown> = {};
    if (params.status) where.status = params.status;
    if (params.orderId != null) where.orderId = params.orderId;
    return this.issueRepo.find({
      where,
      order: { id: 'DESC' },
      take: Math.min(200, params.limit ?? 100),
      relations: { order: true, openedBy: true, resolvedBy: true },
    });
  }

  async findById(id: number): Promise<Issue> {
    const issue = await this.issueRepo.findOne({
      where: { id },
      relations: { order: true, openedBy: true, resolvedBy: true },
    });
    if (!issue) throw new NotFoundException(`Issue ${id} not found`);
    return issue;
  }

  /**
   * Client or ops opens a material claim. Timely (within window) freezes payout.
   */
  async openIssue(
    dto: OpenIssueDto,
    actorUserId: number,
    actorRole: string,
  ): Promise<Issue> {
    const order = await this.ordersRepo.findOne({ where: { id: dto.orderId } });
    if (!order) throw new NotFoundException(`Order ${dto.orderId} not found`);

    const isStaff =
      actorRole === UserRole.OPS_ADMIN || actorRole === UserRole.SUPER_ADMIN;
    if (!isStaff && order.userId !== actorUserId) {
      throw new ForbiddenException('Not your order');
    }

    if (
      order.orderStatus !== OrderStatus.ISSUE_WINDOW_OPEN &&
      order.orderStatus !== OrderStatus.DELIVERED &&
      order.orderStatus !== OrderStatus.COMPLETED &&
      order.orderStatus !== OrderStatus.COLLECTED_BY_CUSTOMER
    ) {
      throw new BadRequestException({
        code: 'issue_not_allowed',
        message: `Cannot open issue while order is ${order.orderStatus}`,
      });
    }

    const now = new Date();
    const withinWindow =
      order.issueWindowEndsAt != null && order.issueWindowEndsAt > now;

    // Late issues still open but do not auto-freeze payout (ops escalation only).
    const evidence = Array.isArray(dto.evidence) ? dto.evidence : [];
    if (dto.notes) {
      evidence.push({ type: 'note', text: dto.notes });
    }

    const issue = this.issueRepo.create({
      orderId: order.id,
      category: dto.category,
      evidence,
      deadline: order.issueWindowEndsAt,
      status: IssueStatus.OPEN,
      payoutImpact: withinWindow
        ? IssuePayoutImpact.FREEZE
        : IssuePayoutImpact.NONE,
      refundAmountMinor: null,
      adjustmentAmountMinor: null,
      openedByUserId: actorUserId,
      resolvedByUserId: null,
      resolutionNotes: null,
      withinWindow,
      openedAt: now,
      resolvedAt: null,
    });
    const saved = await this.issueRepo.save(issue);

    if (withinWindow) {
      await this.payoutsService.freezeForOpenIssue(
        order.id,
        saved.id,
        actorUserId,
        actorRole,
      );
    }

    await this.auditService.append({
      actorId: actorUserId,
      actorRole,
      action: 'issue_open',
      entityType: 'issue',
      entityId: String(saved.id),
      orderId: order.id,
      fromState: null,
      toState: IssueStatus.OPEN,
      reason: dto.category,
      metadata: {
        withinWindow,
        payoutImpact: saved.payoutImpact,
      },
    });

    return saved;
  }

  /**
   * Ops resolution: reprint | refund | adjustment | release | reject.
   * release/reject → clear open_issue payout hold (subject to COD).
   * refund/reprint keep hold until finance/ops separately release if needed;
   * refund path sets resolved_refund and cancels net via hold retention until
   * ops chooses release after refund processing.
   */
  async resolveIssue(
    issueId: number,
    dto: ResolveIssueDto,
    actorUserId: number,
    actorRole: string,
  ): Promise<Issue> {
    const issue = await this.findById(issueId);
    if (!OPEN_STATUSES.includes(issue.status)) {
      throw new BadRequestException({
        code: 'issue_not_open',
        message: `Issue is already ${issue.status}`,
      });
    }

    const { status, payoutImpact, releaseHold } = mapResolvePath(dto.path);
    issue.status = status;
    issue.payoutImpact = payoutImpact;
    issue.resolvedByUserId = actorUserId;
    issue.resolvedAt = new Date();
    issue.resolutionNotes = dto.resolutionNotes ?? null;
    if (dto.refundAmountMinor != null) {
      issue.refundAmountMinor = dto.refundAmountMinor;
    }
    if (dto.adjustmentAmountMinor != null) {
      issue.adjustmentAmountMinor = dto.adjustmentAmountMinor;
    }

    const saved = await this.issueRepo.save(issue);

    if (releaseHold) {
      await this.payoutsService.releaseIssueHold(
        issue.orderId,
        actorUserId,
        actorRole,
        `issue_${dto.path}`,
      );
    }

    // If no other open issues and window expired, allow close hold on issue_window.
    const remaining = await this.issueRepo.count({
      where: {
        orderId: issue.orderId,
        status: In(OPEN_STATUSES),
      },
    });
    if (remaining === 0) {
      const order = await this.ordersRepo.findOne({
        where: { id: issue.orderId },
      });
      if (
        order?.issueWindowEndsAt &&
        order.issueWindowEndsAt <= new Date() &&
        order.orderStatus === OrderStatus.ISSUE_WINDOW_OPEN
      ) {
        await this.payoutsService.closeIssueWindowHold(issue.orderId);
      }
    }

    await this.auditService.append({
      actorId: actorUserId,
      actorRole,
      action: 'issue_resolve',
      entityType: 'issue',
      entityId: String(saved.id),
      orderId: issue.orderId,
      fromState: IssueStatus.OPEN,
      toState: status,
      reason: dto.path,
      metadata: {
        payoutImpact,
        releaseHold,
        refundAmountMinor: saved.refundAmountMinor,
        adjustmentAmountMinor: saved.adjustmentAmountMinor,
      },
    });

    return saved;
  }

  /**
   * Scheduled: close expired issue windows without open claims.
   * delivered/issue_window_open → completed when safe.
   */
  async closeExpiredIssueWindows(): Promise<{
    scanned: number;
    closed: number;
    orderIds: number[];
  }> {
    const now = new Date();
    const candidates = await this.ordersRepo.find({
      where: {
        orderStatus: OrderStatus.ISSUE_WINDOW_OPEN,
        issueWindowEndsAt: LessThanOrEqual(now),
      },
      take: 100,
      order: { id: 'ASC' },
    });

    const closedOrderIds: number[] = [];
    for (const order of candidates) {
      try {
        const openCount = await this.issueRepo.count({
          where: {
            orderId: order.id,
            status: In(OPEN_STATUSES),
          },
        });
        if (openCount > 0) {
          // Keep window state; payout already frozen via open_issue.
          continue;
        }

        await this.dataSource.transaction(async (manager) => {
          const ordersRepo = manager.getRepository(Order);
          const historyRepo = manager.getRepository(OrderStatusHistory);
          const locked = await ordersRepo.findOne({
            where: { id: order.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (
            !locked ||
            locked.orderStatus !== OrderStatus.ISSUE_WINDOW_OPEN
          ) {
            return;
          }
          assertOrderStatusTransition(
            locked.orderStatus,
            OrderStatus.COMPLETED,
          );
          await ordersRepo.update(
            { id: locked.id, orderStatus: OrderStatus.ISSUE_WINDOW_OPEN },
            { orderStatus: OrderStatus.COMPLETED },
          );
          await historyRepo.insert({
            orderId: locked.id,
            fromStatus: OrderStatus.ISSUE_WINDOW_OPEN,
            toStatus: OrderStatus.COMPLETED,
            changedByUserId: 0,
            notes: 'Issue window expired with no open claims',
          });
          await this.auditService.recordOrderStatusTransition(
            {
              orderId: locked.id,
              fromStatus: OrderStatus.ISSUE_WINDOW_OPEN,
              toStatus: OrderStatus.COMPLETED,
              actorUserId: 0,
              actorRole: 'system',
              reason: 'issue_window_expired',
            },
            manager,
          );
          await this.payoutsService.closeIssueWindowHold(locked.id, manager);
        });
        closedOrderIds.push(order.id);
      } catch (err) {
        this.logger.warn(
          `Failed closing issue window for order ${order.id}: ${err}`,
        );
      }
    }

    return {
      scanned: candidates.length,
      closed: closedOrderIds.length,
      orderIds: closedOrderIds,
    };
  }
}

function mapResolvePath(path: IssueResolvePath): {
  status: IssueStatus;
  payoutImpact: IssuePayoutImpact;
  releaseHold: boolean;
} {
  switch (path) {
    case 'reprint':
      return {
        status: IssueStatus.RESOLVED_REPRINT,
        payoutImpact: IssuePayoutImpact.HOLD,
        // Reprint keeps supplier hold until ops explicitly releases after rework.
        releaseHold: false,
      };
    case 'refund':
      return {
        status: IssueStatus.RESOLVED_REFUND,
        payoutImpact: IssuePayoutImpact.HOLD,
        releaseHold: false,
      };
    case 'adjustment':
      return {
        status: IssueStatus.RESOLVED_ADJUSTMENT,
        payoutImpact: IssuePayoutImpact.HOLD,
        releaseHold: false,
      };
    case 'release':
      return {
        status: IssueStatus.CLOSED,
        payoutImpact: IssuePayoutImpact.RELEASE,
        releaseHold: true,
      };
    case 'reject':
      return {
        status: IssueStatus.REJECTED,
        payoutImpact: IssuePayoutImpact.RELEASE,
        releaseHold: true,
      };
    default:
      return {
        status: IssueStatus.CLOSED,
        payoutImpact: IssuePayoutImpact.NONE,
        releaseHold: true,
      };
  }
}
