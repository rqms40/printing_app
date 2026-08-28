import {
  splitSupplierInstallments,
  supplierPayoutInstallmentSnapshot,
} from './payout-installments';

describe('supplier payout installments', () => {
  it('splits even totals 50/50', () => {
    expect(splitSupplierInstallments('10000')).toEqual({
      depositMinor: '5000',
      completionMinor: '5000',
    });
  });

  it('puts the leftover centavo on the completion installment', () => {
    expect(splitSupplierInstallments(10001)).toEqual({
      depositMinor: '5000',
      completionMinor: '5001',
    });
  });

  it('prefers stored installment amounts over a recomputed split', () => {
    const snapshot = supplierPayoutInstallmentSnapshot('20000', {
      depositAmountMinor: '9000',
      completionAmountMinor: '11000',
      authorizedAt: '2026-08-01T00:00:00.000Z',
    });
    expect(snapshot).toEqual({
      payoutGrossMinor: '20000',
      payoutDepositAmountMinor: '9000',
      payoutCompletionAmountMinor: '11000',
      payoutDepositAuthorizedAt: '2026-08-01T00:00:00.000Z',
      payoutCompletionAuthorizedAt: null,
    });
  });
});
