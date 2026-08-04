import {
  COD_MAX_AMOUNT_MINOR,
  COD_PAYOUT_HOLD_REASON,
  CodIneligibilityReason,
  evaluateCodEligibility,
  isCodPaymentMethod,
  parseMinorAmount,
} from './cod-eligibility';

describe('isCodPaymentMethod', () => {
  it.each([
    ['cod', true],
    ['COD', true],
    ['cash', true],
    ['cash_on_delivery', true],
    ['cash-on-delivery', true],
    ['pilot_credit', false],
    ['gcash', false],
    ['paymongo', false],
    [null, false],
    [undefined, false],
    ['', false],
  ])('treats %p as COD=%p', (method, expected) => {
    expect(isCodPaymentMethod(method)).toBe(expected);
  });
});

describe('parseMinorAmount', () => {
  it('parses integer strings and numbers', () => {
    expect(parseMinorAmount('150000')).toBe(150000);
    expect(parseMinorAmount(0)).toBe(0);
    expect(parseMinorAmount(149999)).toBe(149999);
  });

  it('rejects missing, negative, and non-integer values', () => {
    expect(parseMinorAmount(null)).toBeNull();
    expect(parseMinorAmount(undefined)).toBeNull();
    expect(parseMinorAmount('')).toBeNull();
    expect(parseMinorAmount(-1)).toBeNull();
    expect(parseMinorAmount(12.5)).toBeNull();
    expect(parseMinorAmount('abc')).toBeNull();
  });
});

describe('evaluateCodEligibility matrix', () => {
  const base = {
    pilotCodEligible: true,
    opsRiskBlocked: false,
    finalTotalMinor: '150000',
    activeUnpaidCodCount: 0,
    addressZoneEligible: true,
  };

  it('allows exact ₱1,500 when client verified and no concurrent COD', () => {
    const result = evaluateCodEligibility(base);
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.amountMinor).toBe('150000');
    expect(result.maxAmountMinor).toBe(COD_MAX_AMOUNT_MINOR);
  });

  it('rejects ₱1,501 even if client is otherwise eligible (cap)', () => {
    const result = evaluateCodEligibility({
      ...base,
      finalTotalMinor: '150100', // ₱1,501.00
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(CodIneligibilityReason.AMOUNT_EXCEEDS_CAP);
    expect(result.message).toMatch(/₱1,500/);
  });

  it('rejects when client is not pilot COD verified', () => {
    const result = evaluateCodEligibility({
      ...base,
      pilotCodEligible: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(
      CodIneligibilityReason.CLIENT_NOT_VERIFIED,
    );
  });

  it('rejects when another active unpaid COD exists', () => {
    const result = evaluateCodEligibility({
      ...base,
      activeUnpaidCodCount: 1,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(CodIneligibilityReason.ACTIVE_UNPAID_COD);
  });

  it('rejects when ops risk flag is set', () => {
    const result = evaluateCodEligibility({
      ...base,
      opsRiskBlocked: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(CodIneligibilityReason.OPS_RISK_BLOCKED);
  });

  it('rejects when address/zone stub returns ineligible', () => {
    const result = evaluateCodEligibility({
      ...base,
      addressZoneEligible: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(
      CodIneligibilityReason.ADDRESS_ZONE_INELIGIBLE,
    );
  });

  it('defaults address/zone to allow when omitted', () => {
    const { addressZoneEligible: _omit, ...withoutZone } = base;
    const result = evaluateCodEligibility(withoutZone);
    expect(result.eligible).toBe(true);
  });

  it('rejects invalid/missing amount', () => {
    const result = evaluateCodEligibility({
      ...base,
      finalTotalMinor: null,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(CodIneligibilityReason.INVALID_AMOUNT);
  });

  it('accumulates multiple reasons', () => {
    const result = evaluateCodEligibility({
      pilotCodEligible: false,
      opsRiskBlocked: true,
      finalTotalMinor: '200000',
      activeUnpaidCodCount: 2,
      addressZoneEligible: false,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        CodIneligibilityReason.CLIENT_NOT_VERIFIED,
        CodIneligibilityReason.OPS_RISK_BLOCKED,
        CodIneligibilityReason.AMOUNT_EXCEEDS_CAP,
        CodIneligibilityReason.ACTIVE_UNPAID_COD,
        CodIneligibilityReason.ADDRESS_ZONE_INELIGIBLE,
      ]),
    );
  });

  it('exports payout hold reason constant for recon gate', () => {
    expect(COD_PAYOUT_HOLD_REASON).toBe('missing_cod_reconciliation');
  });
});
