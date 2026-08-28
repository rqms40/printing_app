/**
 * GRIDGO pays the supplier in two equal QR installments:
 * 50% at production authorize, 50% after the order is completed.
 * Odd centavos go on the second installment so the two parts sum to the total.
 */
export function splitSupplierInstallments(
  totalMinor: string | number | null | undefined,
): { depositMinor: string; completionMinor: string } {
  const total = Math.max(0, Math.round(Number(totalMinor) || 0));
  const deposit = Math.floor(total / 2);
  return {
    depositMinor: String(deposit),
    completionMinor: String(total - deposit),
  };
}

export type SupplierPayoutInstallmentSource = {
  depositAmountMinor?: string | null;
  completionAmountMinor?: string | null;
  authorizedAt?: Date | string | null;
  completionAuthorizedAt?: Date | string | null;
};

export type SupplierPayoutInstallmentSnapshot = {
  payoutGrossMinor: string;
  payoutDepositAmountMinor: string;
  payoutCompletionAmountMinor: string;
  payoutDepositAuthorizedAt: Date | string | null;
  payoutCompletionAuthorizedAt: Date | string | null;
};

export function supplierPayoutInstallmentSnapshot(
  grossMinor: string | number | null | undefined,
  payout?: SupplierPayoutInstallmentSource | null,
): SupplierPayoutInstallmentSnapshot {
  const gross = String(Math.max(0, Math.round(Number(grossMinor) || 0)));
  const storedDeposit = payout?.depositAmountMinor;
  const storedCompletion = payout?.completionAmountMinor;
  const split =
    storedDeposit != null &&
    storedDeposit !== '' &&
    storedCompletion != null &&
    storedCompletion !== ''
      ? {
          depositMinor: String(storedDeposit),
          completionMinor: String(storedCompletion),
        }
      : splitSupplierInstallments(gross);
  return {
    payoutGrossMinor: gross,
    payoutDepositAmountMinor: split.depositMinor,
    payoutCompletionAmountMinor: split.completionMinor,
    payoutDepositAuthorizedAt: payout?.authorizedAt ?? null,
    payoutCompletionAuthorizedAt: payout?.completionAuthorizedAt ?? null,
  };
}
