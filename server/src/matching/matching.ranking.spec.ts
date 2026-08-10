import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { SupplierCapability } from '../suppliers/entities/supplier-capability.entity';
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from '../suppliers/entities/supplier-verification.entity';
import {
  rankSupplierCandidates,
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
});
