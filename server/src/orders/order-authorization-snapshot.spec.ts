import {
  buildAuthorizationSnapshot,
  freezeAuthorizationSnapshotOnOrder,
  getAuthorizationSnapshot,
  isAuthorizationSnapshotFrozen,
  normalizeMinor,
  pesosToMinor,
  resolveOrderMoneyMinor,
} from './order-authorization-snapshot';
import {
  Order,
  OrderStatus,
  PaymentAuthorizationStatus,
} from './entities/order.entity';

function baseOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    orderId: 'ORD-TEST-1',
    userId: 10,
    category: 'paper',
    quantity: 2,
    totalPrice: 120.5,
    deliveryFee: 49.5,
    finalTotalMinor: null,
    deliveryFeeMinor: null,
    paymentMethod: 'pilot_credit',
    paymentStatus: 'pending',
    paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
    codEligible: false,
    authorizationSnapshot: null,
    orderStatus: OrderStatus.AWAITING_PAYMENT,
    deliveryOption: 'delivery',
    fileMetadataId: 42,
    estimatedCompletionAt: new Date('2026-08-10T08:00:00.000Z'),
    ...overrides,
  } as Order;
}

describe('pesosToMinor / normalizeMinor', () => {
  it.each([
    [0, '0'],
    [1, '100'],
    [12.34, '1234'],
    [12.345, '1235'],
    ['49.50', '4950'],
    [1500, '150000'],
  ])('converts %s pesos to %s centavos', (pesos, expected) => {
    expect(pesosToMinor(pesos)).toBe(expected);
  });

  it('rejects negative or non-finite major amounts', () => {
    expect(() => pesosToMinor(-1)).toThrow(/Invalid major-unit/);
    expect(() => pesosToMinor(Number.NaN)).toThrow(/Invalid major-unit/);
  });

  it('normalizes integer minor strings only', () => {
    expect(normalizeMinor(0)).toBe('0');
    expect(normalizeMinor('150000')).toBe('150000');
    expect(() => normalizeMinor(12.5, 'priceMinor')).toThrow(/priceMinor/);
    expect(() => normalizeMinor(-1)).toThrow(/Invalid/);
  });
});

describe('resolveOrderMoneyMinor', () => {
  it('derives minor units from legacy major decimals', () => {
    expect(
      resolveOrderMoneyMinor({
        totalPrice: 100,
        deliveryFee: 20,
        finalTotalMinor: null,
        deliveryFeeMinor: null,
      }),
    ).toEqual({
      priceMinor: '10000',
      deliveryFeeMinor: '2000',
      finalTotalMinor: '12000',
    });
  });

  it('prefers already-set minor columns', () => {
    expect(
      resolveOrderMoneyMinor({
        totalPrice: 100,
        deliveryFee: 20,
        finalTotalMinor: '15000',
        deliveryFeeMinor: '2500',
      }),
    ).toEqual({
      priceMinor: '12500',
      deliveryFeeMinor: '2500',
      finalTotalMinor: '15000',
    });
  });
});

describe('buildAuthorizationSnapshot', () => {
  it('freezes price, fees, commission, specs, artwork, promised date', () => {
    const snapshot = buildAuthorizationSnapshot(baseOrder(), {
      commissionMinor: 500,
      frozenAt: '2026-08-04T12:00:00.000Z',
    });

    expect(snapshot).toEqual({
      frozenAt: '2026-08-04T12:00:00.000Z',
      priceMinor: '12050',
      deliveryFeeMinor: '4950',
      feesMinor: '0',
      commissionMinor: '500',
      finalTotalMinor: '17000',
      paymentMethod: 'pilot_credit',
      specs: { category: 'paper', quantity: 2 },
      artworkVersion: 42,
      promisedDate: '2026-08-10T08:00:00.000Z',
    });
  });

  it('accepts explicit overrides for matching-settled prices', () => {
    const snapshot = buildAuthorizationSnapshot(baseOrder(), {
      priceMinor: 10000,
      deliveryFeeMinor: 2000,
      feesMinor: 100,
      commissionMinor: 300,
      specs: { paperSize: 'A4' },
      artworkVersion: 'v3',
      promisedDate: '2026-09-01T00:00:00.000Z',
      paymentMethod: 'cod',
      frozenAt: '2026-08-04T00:00:00.000Z',
    });

    expect(snapshot.priceMinor).toBe('10000');
    expect(snapshot.deliveryFeeMinor).toBe('2000');
    expect(snapshot.feesMinor).toBe('100');
    expect(snapshot.finalTotalMinor).toBe('12100');
    expect(snapshot.commissionMinor).toBe('300');
    expect(snapshot.specs).toEqual({ paperSize: 'A4' });
    expect(snapshot.artworkVersion).toBe('v3');
    expect(snapshot.promisedDate).toBe('2026-09-01T00:00:00.000Z');
    expect(snapshot.paymentMethod).toBe('cod');
  });
});

describe('freezeAuthorizationSnapshotOnOrder', () => {
  it('writes snapshot, minor totals, and authorized status', () => {
    const order = baseOrder();
    freezeAuthorizationSnapshotOnOrder(order, {
      frozenAt: '2026-08-04T12:00:00.000Z',
    });

    expect(isAuthorizationSnapshotFrozen(order)).toBe(true);
    expect(order.paymentAuthorizationStatus).toBe(
      PaymentAuthorizationStatus.AUTHORIZED,
    );
    expect(order.finalTotalMinor).toBe('17000');
    expect(order.deliveryFeeMinor).toBe('4950');
    const snap = getAuthorizationSnapshot(order);
    expect(snap?.priceMinor).toBe('12050');
    expect(snap?.frozenAt).toBe('2026-08-04T12:00:00.000Z');
  });

  it('is immutable after the first freeze', () => {
    const order = baseOrder();
    freezeAuthorizationSnapshotOnOrder(order, {
      priceMinor: 10000,
      frozenAt: '2026-08-04T12:00:00.000Z',
    });
    const first = { ...getAuthorizationSnapshot(order)! };

    freezeAuthorizationSnapshotOnOrder(order, {
      priceMinor: 99999,
      frozenAt: '2026-08-05T00:00:00.000Z',
      paymentMethod: 'cod',
    });

    expect(getAuthorizationSnapshot(order)).toEqual(first);
    expect(getAuthorizationSnapshot(order)?.priceMinor).toBe('10000');
    expect(order.paymentAuthorizationStatus).toBe(
      PaymentAuthorizationStatus.AUTHORIZED,
    );
  });
});
