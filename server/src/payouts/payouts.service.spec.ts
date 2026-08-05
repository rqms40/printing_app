import { BadRequestException } from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { PayoutSettlementState } from './entities/payout.entity';

describe('PayoutsService', () => {
  let service: PayoutsService;
  let payoutRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let paymentsService: {
    assertCodReconciledBeforePayout: jest.Mock;
    clearCodPayoutHold: jest.Mock;
  };
  let auditService: { append: jest.Mock };

  beforeEach(() => {
    payoutRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(async (p) => p),
    };
    paymentsService = {
      assertCodReconciledBeforePayout: jest.fn().mockResolvedValue(undefined),
      clearCodPayoutHold: jest.fn().mockResolvedValue(undefined),
    };
    auditService = { append: jest.fn() };
    service = new PayoutsService(
      payoutRepo as any,
      paymentsService as any,
      auditService as any,
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
});
