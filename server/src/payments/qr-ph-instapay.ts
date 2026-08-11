/**
 * QR Ph (Instapay) payment rail helpers.
 * Wire value written by mobile checkout: `qr_ph_instapay`.
 */

export const QR_PH_INSTAPAY_METHOD = 'qr_ph_instapay';

export function isQrPhInstapayPaymentMethod(
  paymentMethod?: string | null,
): boolean {
  if (!paymentMethod) return false;
  const normalized = paymentMethod.replace(/[_-]/g, '').toLowerCase();
  return (
    normalized === 'qrphinstapay' ||
    normalized === 'qrph' ||
    normalized === 'instapayqr'
  );
}
