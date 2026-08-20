import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { SupplierCapability } from '../suppliers/entities/supplier-capability.entity';
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from '../suppliers/entities/supplier-verification.entity';
import {
  rankSupplierCandidates,
  sortByMatchingPreference,
  quoteDistanceFeePesos,
  OrderMatchContext,
  SupplierAcceptanceStats,
} from './matching.ranking';

function capability(
  overrides: Partial<SupplierCapability> & {
    productFamily: string;
    supplierId: number;
  },
): SupplierCapability {
  return {
    id: overrides.id ?? overrides.supplierId * 10,
    supplierId: overrides.supplierId,
    productFamily: overrides.productFamily,
    materials: overrides.materials ?? [],
    maxCapacity: overrides.maxCapacity ?? 10,
    leadTimeDays: overrides.leadTimeDays ?? 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as SupplierCapability;
}

function profile(
  overrides: Partial<SupplierProfile> & {
    id: number;
    verificationStatus?: SupplierVerificationStatus;
    productFamilies?: string[];
  },
): SupplierProfile {
  const families = overrides.productFamilies ?? ['paper'];
  const caps = families.map((f, i) =>
    capability({
      id: overrides.id * 10 + i,
      supplierId: overrides.id,
      productFamily: f,
      maxCapacity: 10,
    }),
  );

  const verification = {
    id: overrides.id,
    supplierId: overrides.id,
    status: overrides.verificationStatus ?? SupplierVerificationStatus.VERIFIED,
  } as SupplierVerification;

  return {
    id: overrides.id,
    userId: overrides.userId ?? overrides.id + 100,
    businessName: overrides.businessName ?? `Supplier ${overrides.id}`,
    serviceZones: overrides.serviceZones ?? [],
    isActive: overrides.isActive ?? true,
    ratingAverage: overrides.ratingAverage ?? 4,
    ratingCount: overrides.ratingCount ?? 1,
    latitude: overrides.latitude ?? null,
    longitude: overrides.longitude ?? null,
    capabilities: overrides.capabilities ?? caps,
    verification: overrides.verification ?? verification,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as SupplierProfile;
}

const baseOrder: OrderMatchContext = {
  orderId: 1,
  category: 'paper',
  quantity: 5,
  zoneTokens: ['Davao City'],
};

describe('rankSupplierCandidates', () => {
  it('excludes unverified suppliers', () => {
    const profiles = [
      profile({
        id: 1,
        verificationStatus: SupplierVerificationStatus.PENDING,
      }),
      profile({
        id: 2,
        verificationStatus: SupplierVerificationStatus.VERIFIED,
      }),
    ];

    const { candidates, excluded } = rankSupplierCandidates(
      baseOrder,
      profiles,
      new Map(),
      new Map(),
    );

    expect(candidates.map((c) => c.supplierId)).toEqual([2]);
    expect(excluded).toContainEqual({
      supplierId: 1,
      reason: 'unverified',
    });
  });

  it('excludes wrong capability (product family)', () => {
    const profiles = [
      profile({ id: 1, productFamilies: ['tarp'] }),
      profile({ id: 2, productFamilies: ['paper'] }),
    ];

    const { candidates, excluded } = rankSupplierCandidates(
      baseOrder,
      profiles,
      new Map(),
      new Map(),
    );

    expect(candidates.map((c) => c.supplierId)).toEqual([2]);
    expect(excluded).toContainEqual({
      supplierId: 1,
      reason: 'no_capability',
    });
  });

  it('excludes inactive and capacity-exhausted suppliers', () => {
    const profiles = [
      profile({ id: 1, isActive: false }),
      profile({
        id: 2,
        capabilities: [
          capability({
            supplierId: 2,
            productFamily: 'paper',
            maxCapacity: 2,
          }),
        ],
      }),
      profile({ id: 3 }),
    ];
    const openLoads = new Map([[2, 2]]);

    const { candidates, excluded } = rankSupplierCandidates(
      baseOrder,
      profiles,
      openLoads,
      new Map(),
    );

    expect(candidates.map((c) => c.supplierId)).toEqual([3]);
    expect(excluded).toEqual(
      expect.arrayContaining([
        { supplierId: 1, reason: 'inactive' },
        { supplierId: 2, reason: 'capacity_exhausted' },
      ]),
    );
  });

  it('excludes zone mismatch when supplier declares zones', () => {
    const profiles = [
      profile({ id: 1, serviceZones: ['Cebu City'] }),
      profile({ id: 2, serviceZones: ['Davao City'] }),
    ];

    const { candidates, excluded } = rankSupplierCandidates(
      baseOrder,
      profiles,
      new Map(),
      new Map(),
    );

    expect(candidates.map((c) => c.supplierId)).toEqual([2]);
    expect(excluded).toContainEqual({
      supplierId: 1,
      reason: 'zone_mismatch',
    });
  });

  it('ranks higher quality and acceptance rate above lower', () => {
    const profiles = [
      profile({ id: 1, ratingAverage: 2, businessName: 'Low' }),
      profile({ id: 2, ratingAverage: 5, businessName: 'High' }),
    ];
    const stats = new Map<number, SupplierAcceptanceStats>([
      [1, { supplierId: 1, accepted: 1, declined: 4, expired: 0 }],
      [2, { supplierId: 2, accepted: 9, declined: 1, expired: 0 }],
    ]);

    const { candidates } = rankSupplierCandidates(
      baseOrder,
      profiles,
      new Map(),
      stats,
    );

    expect(candidates[0].supplierId).toBe(2);
    expect(candidates[0].rankPosition).toBe(1);
    expect(candidates[0].score).toBeGreaterThan(candidates[1].score);
    expect(candidates[0].rankingInputs.formula).toContain('0.35*capability');
  });

  it('excludes shops without a pin when requireShopPin is set', () => {
    const profiles = [
      profile({ id: 1, latitude: 7.05, longitude: 125.58 }),
      profile({ id: 2, latitude: null, longitude: null }),
    ];

    const { candidates, excluded } = rankSupplierCandidates(
      baseOrder,
      profiles,
      new Map(),
      new Map(),
      { requireShopPin: true },
    );

    expect(candidates.map((c) => c.supplierId)).toEqual([1]);
    expect(excluded).toContainEqual({
      supplierId: 2,
      reason: 'missing_pin',
    });
  });

  it('sorts price preference by closest shop pin', () => {
    const dest = { latitude: 7.0731, longitude: 125.6128 };
    const { candidates } = rankSupplierCandidates(
      baseOrder,
      [
        profile({
          id: 1,
          ratingAverage: 5,
          latitude: 7.2,
          longitude: 125.7,
        }),
        profile({
          id: 2,
          ratingAverage: 3,
          latitude: 7.074,
          longitude: 125.613,
        }),
      ],
      new Map(),
      new Map(),
      { requireShopPin: true },
    );

    const ranked = sortByMatchingPreference(candidates, 'price', dest);
    expect(ranked.map((c) => c.supplierId)).toEqual([2, 1]);
    expect(ranked[0].rankingInputs.distanceMeters).toBeLessThan(
      ranked[1].rankingInputs.distanceMeters ?? Infinity,
    );
  });

  it('sorts speed preference by lead time then distance', () => {
    const dest = { latitude: 7.0731, longitude: 125.6128 };
    const { candidates } = rankSupplierCandidates(
      baseOrder,
      [
        profile({
          id: 1,
          latitude: 7.074,
          longitude: 125.613,
          capabilities: [
            capability({
              supplierId: 1,
              productFamily: 'paper',
              leadTimeDays: 3,
            }),
          ],
        }),
        profile({
          id: 2,
          latitude: 7.2,
          longitude: 125.7,
          capabilities: [
            capability({
              supplierId: 2,
              productFamily: 'paper',
              leadTimeDays: 1,
            }),
          ],
        }),
      ],
      new Map(),
      new Map(),
      { requireShopPin: true },
    );

    const ranked = sortByMatchingPreference(candidates, 'speed', dest);
    expect(ranked[0].supplierId).toBe(2);
    expect(ranked[0].rankingInputs.leadTimeDays).toBe(1);
  });

  it('falls price preference back to quality when there is no destination', () => {
    const { candidates } = rankSupplierCandidates(
      baseOrder,
      [
        profile({
          id: 1,
          ratingAverage: 2,
          latitude: 7.074,
          longitude: 125.613,
        }),
        profile({
          id: 2,
          ratingAverage: 5,
          latitude: 7.2,
          longitude: 125.7,
        }),
      ],
      new Map(),
      new Map(),
      { requireShopPin: true },
    );

    const ranked = sortByMatchingPreference(candidates, 'price', null);
    expect(ranked[0].supplierId).toBe(2);
  });

  it('quotes delivery fee as max 25 pesos or 15 per km', () => {
    expect(quoteDistanceFeePesos(0)).toBe(25);
    expect(quoteDistanceFeePesos(1000)).toBe(25);
    expect(quoteDistanceFeePesos(4200)).toBe(63);
  });
});
