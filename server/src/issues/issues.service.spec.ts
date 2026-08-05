import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { IssuesService } from './issues.service';
import {
  IssuePayoutImpact,
  IssueStatus,
} from './entities/issue.entity';
import { OrderStatus } from '../orders/entities/order.entity';

describe('IssuesService', () => {
  let service: IssuesService;
  let issueRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
  };
  let ordersRepo: { findOne: jest.Mock; find: jest.Mock; update: jest.Mock };
  let historyRepo: { insert: jest.Mock };
  let payoutsService: {
    freezeForOpenIssue: jest.Mock;
    releaseIssueHold: jest.Mock;
    closeIssueWindowHold: jest.Mock;
  };
  let auditService: {
    append: jest.Mock;
    recordOrderStatusTransition: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    issueRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 11, ...x })),
      find: jest.fn(),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };
    ordersRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    };
    historyRepo = { insert: jest.fn() };
    payoutsService = {
      freezeForOpenIssue: jest.fn(),
      releaseIssueHold: jest.fn(),
      closeIssueWindowHold: jest.fn(),
    };
    auditService = {
      append: jest.fn(),
      recordOrderStatusTransition: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn(async (fn) =>
        fn({
          getRepository: (entity: { name?: string }) => {
            if (entity?.name === 'Order' || entity === ordersRepo) {
              return ordersRepo;
            }
            return historyRepo;
          },
        }),
      ),
    };
    service = new IssuesService(
      issueRepo as any,
      ordersRepo as any,
      historyRepo as any,
      payoutsService as any,
      auditService as any,
      dataSource as any,
    );
  });

  it('opens timely issue and freezes payout', async () => {
    const ends = new Date(Date.now() + 60_000);
    ordersRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 5,
      orderStatus: OrderStatus.ISSUE_WINDOW_OPEN,
      issueWindowEndsAt: ends,
    });

    const out = await service.openIssue(
      { orderId: 9, category: 'print_defect', notes: 'smudge' },
      5,
      'client',
    );

    expect(out.withinWindow).toBe(true);
    expect(out.payoutImpact).toBe(IssuePayoutImpact.FREEZE);
    expect(out.status).toBe(IssueStatus.OPEN);
    expect(payoutsService.freezeForOpenIssue).toHaveBeenCalledWith(
      9,
      11,
      5,
      'client',
    );
    expect(auditService.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'issue_open' }),
    );
  });

  it('rejects non-owner client', async () => {
    ordersRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 5,
      orderStatus: OrderStatus.ISSUE_WINDOW_OPEN,
      issueWindowEndsAt: new Date(Date.now() + 60_000),
    });
    await expect(
      service.openIssue({ orderId: 9, category: 'damage' }, 99, 'client'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('late issue does not freeze payout', async () => {
    ordersRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 5,
      orderStatus: OrderStatus.COMPLETED,
      issueWindowEndsAt: new Date(Date.now() - 60_000),
    });
    const out = await service.openIssue(
      { orderId: 9, category: 'late_claim' },
      5,
      'client',
    );
    expect(out.withinWindow).toBe(false);
    expect(out.payoutImpact).toBe(IssuePayoutImpact.NONE);
    expect(payoutsService.freezeForOpenIssue).not.toHaveBeenCalled();
  });

  it('resolve release path releases issue hold', async () => {
    issueRepo.findOne.mockResolvedValue({
      id: 11,
      orderId: 9,
      status: IssueStatus.OPEN,
      payoutImpact: IssuePayoutImpact.FREEZE,
    });
    const out = await service.resolveIssue(
      11,
      { path: 'release', resolutionNotes: 'no defect' },
      1,
      'ops_admin',
    );
    expect(out.status).toBe(IssueStatus.CLOSED);
    expect(payoutsService.releaseIssueHold).toHaveBeenCalledWith(
      9,
      1,
      'ops_admin',
      'issue_release',
    );
  });

  it('resolve refund keeps hold', async () => {
    issueRepo.findOne.mockResolvedValue({
      id: 11,
      orderId: 9,
      status: IssueStatus.OPEN,
    });
    const out = await service.resolveIssue(
      11,
      { path: 'refund', refundAmountMinor: '5000' },
      1,
      'ops_admin',
    );
    expect(out.status).toBe(IssueStatus.RESOLVED_REFUND);
    expect(payoutsService.releaseIssueHold).not.toHaveBeenCalled();
  });

  it('blocks resolve when already closed', async () => {
    issueRepo.findOne.mockResolvedValue({
      id: 11,
      orderId: 9,
      status: IssueStatus.CLOSED,
    });
    await expect(
      service.resolveIssue(11, { path: 'release' }, 1, 'ops_admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
