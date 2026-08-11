import { isQrPhInstapayPaymentMethod } from './qr-ph-instapay';

describe('isQrPhInstapayPaymentMethod', () => {
  it('accepts wire and legacy aliases', () => {
    expect(isQrPhInstapayPaymentMethod('qr_ph_instapay')).toBe(true);
    expect(isQrPhInstapayPaymentMethod('qr-ph-instapay')).toBe(true);
    expect(isQrPhInstapayPaymentMethod('QR_PH_INSTAPAY')).toBe(true);
    expect(isQrPhInstapayPaymentMethod('qrph')).toBe(true);
  });

  it('rejects other rails', () => {
    expect(isQrPhInstapayPaymentMethod('cod')).toBe(false);
    expect(isQrPhInstapayPaymentMethod('pilot_credit')).toBe(false);
    expect(isQrPhInstapayPaymentMethod('gcash')).toBe(false);
    expect(isQrPhInstapayPaymentMethod(null)).toBe(false);
    expect(isQrPhInstapayPaymentMethod(undefined)).toBe(false);
  });
});
