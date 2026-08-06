import { BadRequestException } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutSettlementState } from './entities/payout.entity';
import {
  PAYOUT_HOLD_ISSUE_WINDOW,
  PAYOUT_HOLD_OPEN_ISSUE,
} from './payout-hold.constants';
import { SupplierAssignmentDecision } from '../matching/entities/supplier-assignment.entity';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let payoutRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let ordersRepo: { findOne: jest.Mock; save: jest.Mock };
  let assignmentRepo: { findOne: jest.Mock };
  let paymentsService: {
    assertCodReconciledBeforePayout: jest.Mock;
    clearCodPayoutHold: jest.Mock;
    applyCodPayoutHold: jest.Mock;
  };
  let auditService: { append: jest.Mock };
  let geoZonesService: { computeCommissionMinor: jest.Mock };

  beforeEach(() => {
    payoutRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (p) => ({ id: p.id ?? 1, ...p })),
      create: jest.fn((x) => x),
      createQueryBuilder: jest.fn(),
    };
    ordersRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 9,
        totalPrice: 100,
        finalTotalMinor: '10000',
      }),
      save: jest.fn(async (o) => o),
    };
    assignmentRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        orderId: 9,
        supplierId: 3,
        decision: SupplierAssignmentDecision.ACCEPTED,
        finalPriceMinor: '10000',
      }),
    };
    paymentsService = {
      assertCodReconciledBeforePayout: jest.fn().mockResolvedValue(undefined),
      clearCodPayoutHold: jest.fn().mockResolvedValue(undefined),
      applyCodPayoutHold: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { append: jest.fn() };
    geoZonesService = {
      computeCommissionMinor: jest.fn().mockResolvedValue('1500'),
    };
    service = new PayoutsService(
      payoutRepo as any,
      ordersRepo as any,
      assignmentRepo as any,
      paymentsService as any,
      auditService as any,
      geoZonesService as any,
      {
        assertVerifiedOperationalAccess: jest.fn().mockResolvedValue({}),
      } as any,
    );
  });

  it('releases pending payout and audits', async () => {
    payoutRepo.findOne.mockResolvedValue({
      id: 1,
      orderId: 9,
      supplierId: 3,
      netMinor: '10000',
      settlementState: PayoutSettlementState.PENDING,
      holdReason: null,
      settlementReference: null,
    });

    const out = await service.approveRelease(1, 42, 'super_admin', 'REF-1');
    expect(out.settlementState).toBe(PayoutSettlementState.RELEASED);
    expect(out.releaseAuthorityId).toBe(42);
    expect(auditService.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payout_release' }),
    );
  });

  it('blocks held payouts with non-cleared hold reason', async () => {
    payoutRepo.findOne.mockResolvedValue({
      id: 1,
      orderId: 9,
      supplierId: 3,
      netMinor: '10000',
      settlementState: PayoutSettlementState.HELD,
      holdReason: 'open_issue',
    });

    await expect(
      service.approveRelease(1, 42, 'super_admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('invokes COD recon gate before release', async () => {
    payoutRepo.findOne.mockResolvedValue({
      id: 2,
      orderId: 11,
      supplierId: 1,
      netMinor: '5000',
      settlementState: PayoutSettlementState.PENDING,
      holdReason: null,
    });
    await service.approveRelease(2, 1, 'ops_admin');
    expect(paymentsService.assertCodReconciledBeforePayout).toHaveBeenCalledWith(
      11,
    );
  });

  it('opens issue window payout as held on delivery', async () => {
    payoutRepo.findOne.mockResolvedValue(null);
    const { payout, issueWindowEndsAt } =
      await service.openIssueWindowOnDelivered(9, 7);
    expect(payout.settlementState).toBe(PayoutSettlementState.HELD);
    expect(payout.holdReason).toBe(PAYOUT_HOLD_ISSUE_WINDOW);
    expect(payout.holdExpiresAt).toEqual(issueWindowEndsAt);
    expect(payout.grossMinor).toBe('10000');
    expect(payout.commissionMinor).toBe('1500');
    expect(payout.netMinor).toBe('8500');
    expect(ordersRepo.save).toHaveBeenCalled();
    expect(auditService.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payout_issue_window_open' }),
      undefined,
    );
  });

  it('freezes payout for timely open issue', async () => {
    payoutRepo.findOne.mockResolvedValue({
      id: 5,
      orderId: 9,
      settlementState: PayoutSettlementState.HELD,
      holdReason: PAYOUT_HOLD_ISSUE_WINDOW,
      holdExpiresAt: new Date(),
    });
    const out = await service.freezeForOpenIssue(9, 99, 1, 'client');
    expect(out?.holdReason).toBe(PAYOUT_HOLD_OPEN_ISSUE);
    expect(out?.holdExpiresAt).toBeNull();
    expect(out?.settlementState).toBe(PayoutSettlementState.HELD);
    expect(auditService.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payout_freeze_open_issue' }),
      undefined,
    );
  });

  it('releases open_issue hold to pending', async () => {
    payoutRepo.findOne
      .mockResolvedValueOnce({
        id: 5,
        orderId: 9,
        settlementState: PayoutSettlementState.HELD,
        holdReason: PAYOUT_HOLD_OPEN_ISSUE,
      })
      .mockResolvedValueOnce({
        id: 5,
        orderId: 9,
        settlementState: PayoutSettlementState.PENDING,
        holdReason: null,
      });
    const out = await service.releaseIssueHold(9, 1, 'ops_admin', 'issue_release');
    expect(out?.settlementState).toBe(PayoutSettlementState.PENDING);
    expect(paymentsService.applyCodPayoutHold).toHaveBeenCalledWith(9);
  });

  it('closes issue_window hold when timer expires', async () => {
    payoutRepo.findOne.mockResolvedValue({
      id: 5,
      orderId: 9,
      settlementState: PayoutSettlementState.HELD,
      holdReason: PAYOUT_HOLD_ISSUE_WINDOW,
      holdExpiresAt: new Date(),
    });
    const out = await service.closeIssueWindowHold(9);
    expect(out?.settlementState).toBe(PayoutSettlementState.PENDING);
    expect(out?.holdReason).toBeNull();
    expect(auditService.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payout_issue_window_close' }),
      undefined,
    );
  });

  it('does not close hold when frozen for open_issue', async () => {
    payoutRepo.findOne.mockResolvedValue({
      id: 5,
      orderId: 9,
      settlementState: PayoutSettlementState.HELD,
      holdReason: PAYOUT_HOLD_OPEN_ISSUE,
    });
    const out = await service.closeIssueWindowHold(9);
    expect(out?.holdReason).toBe(PAYOUT_HOLD_OPEN_ISSUE);
    expect(payoutRepo.save).not.toHaveBeenCalled();
  });
});
