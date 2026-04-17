# Admin User Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin user detail page plus a customer-focused Users analytics tab so admins can inspect one user profile and understand aggregate customer demographics and behavior.

**Architecture:** Keep the backend as the source of truth for detail and analytics payloads, with pure aggregation helpers extracted out of the controller so the logic is testable without HTTP wiring. On the admin side, add one focused user detail page and one focused dashboard `Users` tab, with the existing `/users` list staying operational and mostly unchanged except for explicit navigation into the new show page.

**Tech Stack:** NestJS 11, TypeORM, Jest, React 18, Refine, React Router v6, Ant Design 5, Recharts, Vitest, Testing Library

---

## File Structure

### Backend

- Create: `server/src/admin/user-insights.ts`
  - Pure mappers and aggregators for:
    - `buildAdminUserDetailPayload`
    - `buildAdminUsersAnalyticsPayload`
    - `normalizeUserInsightsPeriod`
- Create: `server/src/admin/user-insights.spec.ts`
  - Unit tests for pure admin user detail and users analytics calculations.
- Modify: `server/src/admin/admin.controller.ts`
  - Add:
    - `GET /admin/users/analytics?period=7D|30D|6M`
    - `GET /admin/users/:id`
  - Keep `GET /admin/users` as the list source.
- Modify: `server/src/admin/admin.controller.spec.ts`
  - Add controller wiring tests for the new endpoints and repository call boundaries.

### Admin frontend

- Modify: `admin/src/App.tsx`
  - Register the `users` show route and resource metadata.
- Modify: `admin/src/utils/api-normalizers.ts`
  - Add normalized types and mappers for admin user detail payloads.
- Modify: `admin/src/pages/users/data.ts`
  - Add `loadAdminUserDetail()` and a small show-page view-model helper.
- Modify: `admin/src/pages/users/data.test.ts`
  - Cover user-detail loading and error-state shaping.
- Modify: `admin/src/pages/users/list.tsx`
  - Add an explicit `View` action column that links to `/users/show/:id`.
- Create: `admin/src/pages/users/list.test.tsx`
  - Verify the `View` action renders and points at the show page.
- Create: `admin/src/pages/users/show.tsx`
  - Dedicated admin user detail page using Refine’s `Show` shell plus local API loading.
- Create: `admin/src/pages/users/show.test.tsx`
  - Verify ready, sparse-data, loading, and error rendering.
- Create: `admin/src/pages/dashboard/users-analytics.ts`
  - Normalize and load the backend users analytics payload.
- Create: `admin/src/pages/dashboard/users-analytics.test.ts`
  - Cover payload normalization, malformed-series filtering, and retry view-model behavior.
- Create: `admin/src/pages/dashboard/users-tab.tsx`
  - Render the `Users` analytics tab cards, charts, period filter, and inline error state.
- Create: `admin/src/pages/dashboard/users-tab.test.tsx`
  - Verify KPI rendering, retry state, and period switching.
- Modify: `admin/src/pages/dashboard/index.tsx`
  - Introduce top-level dashboard tabs:
    - `Operations`
    - `Orders`
    - `Users`
  - Keep the existing operational/order widgets intact, move only what is needed to make room for `UsersTab`.

## Shared Contract Decisions

- `GET /admin/users/:id` returns:

```json
{
  "user": {
    "id": 7,
    "full_name": "Maria Santos",
    "email": "maria@gridprint.ph",
    "phone_number": "+639171234567",
    "role": "customer",
    "is_active": true,
    "is_profile_complete": true,
    "profile_category": "student",
    "profile_field": "architecture",
    "course": "BS Architecture",
    "organization": "Mapua University",
    "gender": "female",
    "date_of_birth": "1995-06-15T00:00:00.000Z",
    "printing_preferences": ["plotting_blueprints", "high_res_color"],
    "created_at": "2026-04-10T10:00:00.000Z",
    "updated_at": "2026-04-17T05:00:00.000Z"
  },
  "metrics": {
    "total_orders": 12,
    "paid_orders": 10,
    "total_spend": 4820,
    "average_order_value": 482,
    "last_order_at": "2026-04-16T14:00:00.000Z",
    "last_paid_order_at": "2026-04-16T14:00:00.000Z"
  },
  "recent_orders": [
    {
      "id": 21,
      "order_id": "ORD-10021",
      "category": "paper",
      "order_status": "delivered",
      "payment_status": "paid",
      "total_price": 220,
      "created_at": "2026-04-16T14:00:00.000Z"
    }
  ]
}
```

- `GET /admin/users/analytics?period=7D|30D|6M` returns:

```json
{
  "summary": {
    "total_customers": 124,
    "new_customers": 18,
    "active_customers": 71,
    "profile_completion_rate": 82,
    "role_counts": {
      "customers": 124,
      "drivers": 8,
      "admins": 2
    }
  },
  "signup_trend": [{ "label": "Apr 17", "value": 4 }],
  "profile_category_mix": [{ "label": "Student", "value": 80 }],
  "profile_field_mix": [{ "label": "Architecture", "value": 32 }],
  "top_segments": [{ "label": "Student / Architecture", "value": 28 }],
  "preference_mix": [{ "label": "Plotting Blueprints", "value": 42 }],
  "activity_split": [
    { "label": "Active", "value": 71 },
    { "label": "Dormant", "value": 53 }
  ],
  "revenue_by_segment": [{ "label": "Student / Architecture", "value": 12840 }]
}
```

- Definitions used everywhere:
  - `new_customers`: customer users with `created_at` inside the selected period.
  - `active_customers`: distinct customers with at least one order inside the selected period.
  - `profile_completion_rate`: rounded whole-number percentage of customers where `is_profile_complete === true`.
  - `average_order_value`: `total_spend / paid_orders`, rounded to two decimals, `0` when `paid_orders === 0`.
  - `dormant`: customers with no orders inside the selected period.
  - `revenue_by_segment`: paid revenue only.

### Task 1: Backend Pure User Insights Helpers

**Files:**
- Create: `server/src/admin/user-insights.ts`
- Test: `server/src/admin/user-insights.spec.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User, UserRole } from '../users/entities/user.entity';
import {
  buildAdminUserDetailPayload,
  buildAdminUsersAnalyticsPayload,
} from './user-insights';

describe('buildAdminUserDetailPayload', () => {
  it('maps one user plus their orders into the admin detail payload', () => {
    const user = {
      id: 7,
      fullName: 'Maria Santos',
      email: 'maria@gridprint.ph',
      phoneNumber: '+639171234567',
      role: UserRole.CUSTOMER,
      isActive: true,
      isProfileComplete: true,
      profileCategory: 'student',
      profileField: 'architecture',
      course: 'BS Architecture',
      organization: 'Mapua University',
      gender: 'female',
      dateOfBirth: new Date('1995-06-15T00:00:00.000Z'),
      printingPreferences: ['plotting_blueprints', 'high_res_color'],
      createdAt: new Date('2026-04-10T10:00:00.000Z'),
      updatedAt: new Date('2026-04-17T05:00:00.000Z'),
    } as User;

    const orders = [
      {
        id: 21,
        orderId: 'ORD-10021',
        userId: 7,
        category: 'paper',
        orderStatus: OrderStatus.DELIVERED,
        paymentStatus: 'paid',
        totalPrice: 220,
        createdAt: new Date('2026-04-16T14:00:00.000Z'),
      },
      {
        id: 18,
        orderId: 'ORD-10018',
        userId: 7,
        category: '3d',
        orderStatus: OrderStatus.PRINTING_IN_PROGRESS,
        paymentStatus: 'pending',
        totalPrice: 480,
        createdAt: new Date('2026-04-14T10:00:00.000Z'),
      },
    ] as Order[];

    expect(buildAdminUserDetailPayload(user, orders)).toEqual({
      user: expect.objectContaining({
        id: 7,
        full_name: 'Maria Santos',
        profile_category: 'student',
        profile_field: 'architecture',
        gender: 'female',
      }),
      metrics: {
        total_orders: 2,
        paid_orders: 1,
        total_spend: 220,
        average_order_value: 220,
        last_order_at: new Date('2026-04-16T14:00:00.000Z'),
        last_paid_order_at: new Date('2026-04-16T14:00:00.000Z'),
      },
      recent_orders: [
        expect.objectContaining({ order_id: 'ORD-10021' }),
        expect.objectContaining({ order_id: 'ORD-10018' }),
      ],
    });
  });
});

describe('buildAdminUsersAnalyticsPayload', () => {
  it('builds customer-focused demographics and behavior metrics for the selected period', () => {
    const users = [
      {
        id: 1,
        fullName: 'New Student',
        email: 'new.student@example.com',
        role: UserRole.CUSTOMER,
        isProfileComplete: true,
        profileCategory: 'student',
        profileField: 'architecture',
        printingPreferences: ['plotting_blueprints'],
        createdAt: new Date('2026-04-10T00:00:00.000Z'),
      },
      {
        id: 2,
        fullName: 'Dormant Pro',
        email: 'dormant.pro@example.com',
        role: UserRole.CUSTOMER,
        isProfileComplete: false,
        profileCategory: 'professional',
        profileField: 'business_corporate',
        printingPreferences: ['marketing_materials'],
        createdAt: new Date('2026-02-10T00:00:00.000Z'),
      },
      {
        id: 3,
        fullName: 'Driver One',
        email: 'driver.one@example.com',
        role: UserRole.DRIVER,
        isProfileComplete: true,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
    ] as User[];

    const orders = [
      {
        id: 101,
        orderId: 'ORD-101',
        userId: 1,
        paymentStatus: 'paid',
        orderStatus: OrderStatus.DELIVERED,
        totalPrice: 200,
        createdAt: new Date('2026-04-16T00:00:00.000Z'),
      },
      {
        id: 102,
        orderId: 'ORD-102',
        userId: 2,
        paymentStatus: 'paid',
        orderStatus: OrderStatus.DELIVERED,
        totalPrice: 400,
        createdAt: new Date('2026-02-20T00:00:00.000Z'),
      },
    ] as Order[];

    expect(
      buildAdminUsersAnalyticsPayload(
        users,
        orders,
        '30D',
        new Date('2026-04-17T12:00:00.000Z'),
      ),
    ).toEqual(
      expect.objectContaining({
        summary: {
          total_customers: 2,
          new_customers: 1,
          active_customers: 1,
          profile_completion_rate: 50,
          role_counts: {
            customers: 2,
            drivers: 1,
            admins: 0,
          },
        },
        profile_category_mix: [
          { label: 'Professional', value: 1 },
          { label: 'Student', value: 1 },
        ],
        top_segments: [
          { label: 'Professional / Business Corporate', value: 1 },
          { label: 'Student / Architecture', value: 1 },
        ],
        activity_split: [
          { label: 'Active', value: 1 },
          { label: 'Dormant', value: 1 },
        ],
        revenue_by_segment: [{ label: 'Student / Architecture', value: 200 }],
      }),
    );
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `cd /home/jd/projects/printing_app/server && npm test -- admin/user-insights.spec.ts --runInBand`

Expected: FAIL with `Cannot find module './user-insights'` or missing exported function errors.

- [ ] **Step 3: Write the minimal helper implementation**

```ts
import { Order } from '../orders/entities/order.entity';
import { User, UserRole } from '../users/entities/user.entity';

export type UserInsightsPeriod = '7D' | '30D' | '6M';

type AnalyticsPoint = { label: string; value: number };

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function humanize(value: string | null | undefined, fallback = 'Unknown') {
  if (!value) return fallback;
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function mapAdminUser(user: User) {
  return {
    id: user.id,
    full_name: user.fullName ?? null,
    email: user.email,
    phone_number: user.phoneNumber ?? null,
    role: user.role,
    is_active: user.isActive,
    is_profile_complete: user.isProfileComplete,
    profile_category: user.profileCategory ?? null,
    profile_field: user.profileField ?? null,
    course: user.course ?? null,
    organization: user.organization ?? null,
    gender: user.gender ?? null,
    date_of_birth: user.dateOfBirth ?? null,
    printing_preferences: user.printingPreferences ?? [],
    created_at: user.createdAt,
    updated_at: user.updatedAt,
  };
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function formatDayLabel(date: Date) {
  return `${MONTH_LABELS[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, '0')}`;
}

function formatMonthLabel(date: Date) {
  return MONTH_LABELS[date.getUTCMonth()];
}

function buildBuckets(period: UserInsightsPeriod, now: Date) {
  if (period === '6M') {
    const currentMonth = startOfUtcMonth(now);
    const start = addUtcMonths(currentMonth, -5);
    return Array.from({ length: 6 }, (_, index) => {
      const date = addUtcMonths(start, index);
      return {
        key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
        label: formatMonthLabel(date),
        start: date,
      };
    });
  }

  const days = period === '7D' ? 7 : 30;
  const currentDay = startOfUtcDay(now);
  const start = addUtcDays(currentDay, -(days - 1));
  return Array.from({ length: days }, (_, index) => {
    const date = addUtcDays(start, index);
    return {
      key: date.toISOString().slice(0, 10),
      label: formatDayLabel(date),
      start: date,
    };
  });
}

function getBucketKey(date: Date, period: UserInsightsPeriod) {
  if (period === '6M') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function sortPoints(points: Map<string, number>): AnalyticsPoint[] {
  return Array.from(points.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}

export function normalizeUserInsightsPeriod(period?: string): UserInsightsPeriod {
  return period === '7D' || period === '30D' || period === '6M' ? period : '30D';
}

export function buildAdminUserDetailPayload(user: User, orders: Order[]) {
  const sortedOrders = [...orders].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
  const paidOrders = sortedOrders.filter((order) => order.paymentStatus === 'paid');
  const totalSpend = paidOrders.reduce((sum, order) => sum + Number(order.totalPrice), 0);

  return {
    user: mapAdminUser(user),
    metrics: {
      total_orders: sortedOrders.length,
      paid_orders: paidOrders.length,
      total_spend: totalSpend,
      average_order_value: paidOrders.length === 0 ? 0 : Number((totalSpend / paidOrders.length).toFixed(2)),
      last_order_at: sortedOrders[0]?.createdAt ?? null,
      last_paid_order_at: paidOrders[0]?.createdAt ?? null,
    },
    recent_orders: sortedOrders.slice(0, 5).map((order) => ({
      id: order.id,
      order_id: order.orderId,
      category: order.category,
      order_status: order.orderStatus,
      payment_status: order.paymentStatus,
      total_price: Number(order.totalPrice),
      created_at: order.createdAt,
    })),
  };
}

export function buildAdminUsersAnalyticsPayload(
  users: User[],
  orders: Order[],
  period: UserInsightsPeriod,
  now = new Date(),
) {
  const customers = users.filter((user) => user.role === UserRole.CUSTOMER);
  const buckets = buildBuckets(period, now);
  const earliestBucket = buckets[0]?.start ?? now;
  const signupTrend = new Map<string, number>(buckets.map((bucket) => [bucket.key, 0]));
  const categoryMix = new Map<string, number>();
  const fieldMix = new Map<string, number>();
  const segmentMix = new Map<string, number>();
  const preferenceMix = new Map<string, number>();
  const revenueBySegment = new Map<string, number>();
  const activeCustomerIds = new Set<number>();

  for (const customer of customers) {
    if (customer.createdAt >= earliestBucket) {
      const bucketKey = getBucketKey(customer.createdAt, period);
      if (signupTrend.has(bucketKey)) {
        signupTrend.set(bucketKey, (signupTrend.get(bucketKey) ?? 0) + 1);
      }
    }

    const categoryLabel = humanize(customer.profileCategory);
    const fieldLabel = humanize(customer.profileField);
    const segmentLabel = `${categoryLabel} / ${fieldLabel}`;

    categoryMix.set(categoryLabel, (categoryMix.get(categoryLabel) ?? 0) + 1);
    fieldMix.set(fieldLabel, (fieldMix.get(fieldLabel) ?? 0) + 1);
    segmentMix.set(segmentLabel, (segmentMix.get(segmentLabel) ?? 0) + 1);

    for (const preference of customer.printingPreferences ?? []) {
      const label = humanize(preference);
      preferenceMix.set(label, (preferenceMix.get(label) ?? 0) + 1);
    }
  }

  for (const order of orders) {
    if (order.createdAt >= earliestBucket) {
      activeCustomerIds.add(order.userId);
    }

    if (order.paymentStatus !== 'paid') {
      continue;
    }

    const customer = customers.find((user) => user.id === order.userId);
    if (!customer) {
      continue;
    }

    const segmentLabel = `${humanize(customer.profileCategory)} / ${humanize(customer.profileField)}`;
    revenueBySegment.set(
      segmentLabel,
      (revenueBySegment.get(segmentLabel) ?? 0) + Number(order.totalPrice),
    );
  }

  const completeProfiles = customers.filter((customer) => customer.isProfileComplete).length;

  return {
    summary: {
      total_customers: customers.length,
      new_customers: customers.filter((customer) => customer.createdAt >= earliestBucket).length,
      active_customers: activeCustomerIds.size,
      profile_completion_rate: customers.length === 0
        ? 0
        : Math.round((completeProfiles / customers.length) * 100),
      role_counts: {
        customers: customers.length,
        drivers: users.filter((user) => user.role === UserRole.DRIVER).length,
        admins: users.filter((user) => user.role === UserRole.ADMIN).length,
      },
    },
    signup_trend: buckets.map((bucket) => ({ label: bucket.label, value: signupTrend.get(bucket.key) ?? 0 })),
    profile_category_mix: sortPoints(categoryMix),
    profile_field_mix: sortPoints(fieldMix),
    top_segments: sortPoints(segmentMix).slice(0, 5),
    preference_mix: sortPoints(preferenceMix),
    activity_split: [
      { label: 'Active', value: activeCustomerIds.size },
      { label: 'Dormant', value: Math.max(customers.length - activeCustomerIds.size, 0) },
    ],
    revenue_by_segment: sortPoints(revenueBySegment).slice(0, 5),
  };
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `cd /home/jd/projects/printing_app/server && npm test -- admin/user-insights.spec.ts --runInBand`

Expected: PASS with both helper suites green.

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app/server
git add src/admin/user-insights.ts src/admin/user-insights.spec.ts
git commit -m "feat: add admin user insights helpers"
```

### Task 2: Backend Admin Controller Endpoints

**Files:**
- Modify: `server/src/admin/admin.controller.ts`
- Modify: `server/src/admin/admin.controller.spec.ts`
- Reuse: `server/src/admin/user-insights.ts`

- [ ] **Step 1: Write the failing controller wiring tests**

```ts
describe('getUserDetail', () => {
  it('loads one user and only that users orders for the admin show page', async () => {
    usersRepo.findOneOrFail.mockResolvedValue({
      id: 7,
      email: 'maria@gridprint.ph',
      role: 'customer',
      createdAt: new Date('2026-04-10T10:00:00.000Z'),
      updatedAt: new Date('2026-04-17T05:00:00.000Z'),
    } as User);
    ordersRepo.find.mockResolvedValue([] as Order[]);

    await controller.getUserDetail(7);

    expect(usersRepo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(ordersRepo.find).toHaveBeenCalledWith({
      where: { userId: 7 },
      order: { createdAt: 'DESC' },
    });
  });
});

describe('getUsersAnalytics', () => {
  it('loads users and orders before delegating analytics shaping', async () => {
    usersRepo.find.mockResolvedValue([] as User[]);
    ordersRepo.find.mockResolvedValue([] as Order[]);

    await controller.getUsersAnalytics('30D');

    expect(usersRepo.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
    });
    expect(ordersRepo.find).toHaveBeenCalledWith({
      order: { createdAt: 'DESC' },
    });
  });
});
```

- [ ] **Step 2: Run the controller spec to verify it fails**

Run: `cd /home/jd/projects/printing_app/server && npm test -- admin/admin.controller.spec.ts --runInBand`

Expected: FAIL with TypeScript errors such as `Property 'getUserDetail' does not exist on type 'AdminController'`.

- [ ] **Step 3: Implement the controller routes**

```ts
import {
  buildAdminUserDetailPayload,
  buildAdminUsersAnalyticsPayload,
  normalizeUserInsightsPeriod,
} from './user-insights';

// Keep this route above :id so "analytics" never falls through to ParseIntPipe.
@Get('users/analytics')
async getUsersAnalytics(@Query('period') period?: string) {
  const normalizedPeriod = normalizeUserInsightsPeriod(period);
  const [users, orders] = await Promise.all([
    this.usersRepo.find({ order: { createdAt: 'DESC' } }),
    this.ordersRepo.find({ order: { createdAt: 'DESC' } }),
  ]);

  return buildAdminUsersAnalyticsPayload(
    users,
    orders,
    normalizedPeriod,
    new Date(),
  );
}

@Get('users/:id')
async getUserDetail(@Param('id', ParseIntPipe) id: number) {
  const user = await this.usersRepo.findOneOrFail({ where: { id } });
  const orders = await this.ordersRepo.find({
    where: { userId: id },
    order: { createdAt: 'DESC' },
  });

  return buildAdminUserDetailPayload(user, orders);
}
```

- [ ] **Step 4: Run the backend tests that cover the new endpoints**

Run: `cd /home/jd/projects/printing_app/server && npm test -- admin/user-insights.spec.ts admin/admin.controller.spec.ts --runInBand`

Expected: PASS with the new detail and analytics controller tests green.

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app/server
git add src/admin/admin.controller.ts src/admin/admin.controller.spec.ts src/admin/user-insights.ts src/admin/user-insights.spec.ts
git commit -m "feat: add admin user detail and analytics endpoints"
```

### Task 3: Admin User Detail Data Layer

**Files:**
- Modify: `admin/src/utils/api-normalizers.ts`
- Modify: `admin/src/pages/users/data.ts`
- Modify: `admin/src/pages/users/data.test.ts`

- [ ] **Step 1: Write the failing admin data tests**

```ts
it('loads a single admin user detail payload and normalizes nested fields', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    data: {
      user: {
        id: 7,
        fullName: 'Maria Santos',
        email: 'maria@gridprint.ph',
        phoneNumber: '+639171234567',
        role: 'customer',
        isActive: true,
        isProfileComplete: true,
        profileCategory: 'student',
        profileField: 'architecture',
        course: 'BS Architecture',
        organization: 'Mapua University',
        gender: 'female',
        dateOfBirth: '1995-06-15T00:00:00.000Z',
        printingPreferences: ['plotting_blueprints'],
        createdAt: '2026-04-10T10:00:00.000Z',
        updatedAt: '2026-04-17T05:00:00.000Z',
      },
      metrics: {
        total_orders: 2,
        paid_orders: 1,
        total_spend: 220,
        average_order_value: 220,
        last_order_at: '2026-04-16T14:00:00.000Z',
        last_paid_order_at: '2026-04-16T14:00:00.000Z',
      },
      recent_orders: [
        {
          id: 21,
          order_id: 'ORD-10021',
          category: 'paper',
          order_status: 'delivered',
          payment_status: 'paid',
          total_price: 220,
          created_at: '2026-04-16T14:00:00.000Z',
        },
      ],
    },
  });

  await expect(loadAdminUserDetail(7)).resolves.toEqual({
    user: expect.objectContaining({
      id: 7,
      full_name: 'Maria Santos',
      date_of_birth: '1995-06-15T00:00:00.000Z',
    }),
    metrics: expect.objectContaining({
      total_orders: 2,
      total_spend: 220,
    }),
    recent_orders: [expect.objectContaining({ order_id: 'ORD-10021' })],
  });
  expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('/admin/users/7');
});

it('builds an error view with retry when the user detail request fails', () => {
  const view = buildAdminUserDetailViewModel({
    loading: false,
    detail: null,
    error: 'Request failed',
  });

  expect(view.kind).toBe('error');
  if (view.kind !== 'error') throw new Error('Expected error view');
  expect(view.retryLabel).toBe('Retry');
  expect(view.message).toContain('Request failed');
});
```

- [ ] **Step 2: Run the users data test file to verify it fails**

Run: `cd /home/jd/projects/printing_app/admin && npm test -- src/pages/users/data.test.ts`

Expected: FAIL with missing export errors for `loadAdminUserDetail` and `buildAdminUserDetailViewModel`.

- [ ] **Step 3: Implement the normalizer and data-loader additions**

```ts
export interface AdminUserOrderPreviewRecord {
  id: number;
  order_id: string;
  category: 'paper' | '3d';
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  total_price: number;
  created_at: string;
}

export interface AdminUserDetailRecord {
  user: AdminUserRecord & {
    gender: string | null;
    date_of_birth: string | null;
  };
  metrics: {
    total_orders: number;
    paid_orders: number;
    total_spend: number;
    average_order_value: number;
    last_order_at: string | null;
    last_paid_order_at: string | null;
  };
  recent_orders: AdminUserOrderPreviewRecord[];
}

export function normalizeAdminUserDetail(payload: unknown): AdminUserDetailRecord {
  const record = asRecord(payload);
  const metrics = asRecord(read(record, 'metrics'));

  return {
    user: {
      ...normalizeAdminUser(read(record, 'user')),
      gender: toOptionalString(asRecord(read(record, 'user')), 'gender') ?? null,
      date_of_birth:
        toOptionalString(asRecord(read(record, 'user')), 'date_of_birth', 'dateOfBirth') ?? null,
    },
    metrics: {
      total_orders: toNumberValue(metrics, 0, 'total_orders'),
      paid_orders: toNumberValue(metrics, 0, 'paid_orders'),
      total_spend: toNumberValue(metrics, 0, 'total_spend'),
      average_order_value: toNumberValue(metrics, 0, 'average_order_value'),
      last_order_at: toOptionalString(metrics, 'last_order_at') ?? null,
      last_paid_order_at: toOptionalString(metrics, 'last_paid_order_at') ?? null,
    },
    recent_orders: Array.isArray(read(record, 'recent_orders'))
      ? (read(record, 'recent_orders') as unknown[]).map((item) => {
          const order = asRecord(item);
          return {
            id: toNumberValue(order, 0, 'id'),
            order_id: toRequiredString(order, '', 'order_id', 'orderId'),
            category: toRequiredString(order, 'paper', 'category') === '3d' ? '3d' : 'paper',
            order_status: toRequiredString(order, 'order_placed', 'order_status', 'orderStatus') as OrderStatus,
            payment_status: toRequiredString(order, 'pending', 'payment_status', 'paymentStatus') as PaymentStatus,
            total_price: toNumberValue(order, 0, 'total_price', 'totalPrice'),
            created_at: toRequiredString(order, EMPTY_DATE, 'created_at', 'createdAt'),
          };
        })
      : [],
  };
}
```

```ts
export async function loadAdminUserDetail(id: number | string): Promise<AdminUserDetailRecord> {
  const response = await apiClient.get(`/admin/users/${id}`);
  return normalizeAdminUserDetail(response.data);
}

type AdminUserDetailState = {
  loading: boolean;
  detail: AdminUserDetailRecord | null;
  error: string | null;
};

type AdminUserDetailViewModel =
  | { kind: 'loading'; title: string }
  | { kind: 'ready'; detail: AdminUserDetailRecord }
  | { kind: 'error'; title: string; message: string; retryLabel: string };

export function buildAdminUserDetailViewModel(
  state: AdminUserDetailState,
): AdminUserDetailViewModel {
  if (state.loading) {
    return { kind: 'loading', title: 'User' };
  }

  if (state.error || !state.detail) {
    return {
      kind: 'error',
      title: 'User',
      message: state.error ?? 'User not found',
      retryLabel: 'Retry',
    };
  }

  return {
    kind: 'ready',
    detail: state.detail,
  };
}
```

- [ ] **Step 4: Run the admin data tests to verify they pass**

Run: `cd /home/jd/projects/printing_app/admin && npm test -- src/pages/users/data.test.ts`

Expected: PASS with both the list and user-detail data tests green.

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app/admin
git add src/utils/api-normalizers.ts src/pages/users/data.ts src/pages/users/data.test.ts
git commit -m "feat: add admin user detail data contract"
```

### Task 4: Admin User Show Page And List Navigation

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/pages/users/list.tsx`
- Create: `admin/src/pages/users/list.test.tsx`
- Create: `admin/src/pages/users/show.tsx`
- Create: `admin/src/pages/users/show.test.tsx`

- [ ] **Step 1: Write the failing UI tests**

```tsx
// admin/src/pages/users/list.test.tsx
// @vitest-environment happy-dom
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { UserList } from './list';

vi.mock('@/providers/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: [
        {
          id: 7,
          full_name: 'Maria Santos',
          email: 'maria@gridprint.ph',
          role: 'customer',
          is_active: true,
          is_profile_complete: true,
          profile_category: 'student',
          profile_field: 'architecture',
          printing_preferences: ['plotting_blueprints'],
          created_at: '2026-04-10T10:00:00.000Z',
          updated_at: '2026-04-17T05:00:00.000Z',
        },
      ],
    }),
  },
}));

describe('UserList', () => {
  it('renders a View action that points to the user show page', async () => {
    render(
      <MemoryRouter>
        <UserList />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/users/show/7',
    );
  });
});
```

```tsx
// admin/src/pages/users/show.test.tsx
// @vitest-environment happy-dom
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { UserShow } from './show';

vi.mock('./data', () => ({
  loadAdminUserDetail: vi.fn().mockResolvedValue({
    user: {
      id: 7,
      full_name: 'Maria Santos',
      email: 'maria@gridprint.ph',
      phone_number: '+639171234567',
      role: 'customer',
      is_active: true,
      is_profile_complete: true,
      profile_category: 'student',
      profile_field: 'architecture',
      course: null,
      organization: null,
      gender: 'female',
      date_of_birth: '1995-06-15T00:00:00.000Z',
      printing_preferences: [],
      created_at: '2026-04-10T10:00:00.000Z',
      updated_at: '2026-04-17T05:00:00.000Z',
    },
    metrics: {
      total_orders: 2,
      paid_orders: 1,
      total_spend: 220,
      average_order_value: 220,
      last_order_at: '2026-04-16T14:00:00.000Z',
      last_paid_order_at: '2026-04-16T14:00:00.000Z',
    },
    recent_orders: [],
  }),
  buildAdminUserDetailViewModel: vi.fn((state) => (
    state.detail
      ? { kind: 'ready', detail: state.detail }
      : { kind: 'loading', title: 'User' }
  )),
}));

describe('UserShow', () => {
  it('renders profile placeholders when optional profile fields are missing', async () => {
    render(
      <MemoryRouter initialEntries={['/users/show/7']}>
        <Routes>
          <Route path="/users/show/:id" element={<UserShow />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('No course provided')).toBeInTheDocument();
    expect(screen.getByText('No organization provided')).toBeInTheDocument();
    expect(screen.getByText('No print preferences yet')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the new UI tests to verify they fail**

Run: `cd /home/jd/projects/printing_app/admin && npm test -- src/pages/users/list.test.tsx src/pages/users/show.test.tsx`

Expected: FAIL because the tests reference missing files, missing route registration, and no `View` action.

- [ ] **Step 3: Implement the user show page and list navigation**

```tsx
// admin/src/App.tsx
{
  name: 'users',
  list: '/users',
  show: '/users/show/:id',
  meta: { label: 'Users', icon: <TeamOutlined /> },
}

<Route path="/users">
  <Route index element={<UserList />} />
  <Route path="show/:id" element={<UserShow />} />
</Route>
```

```tsx
// admin/src/pages/users/list.tsx
import { Link } from 'react-router-dom';
import { Button } from 'antd';

<Table.Column
  title="Actions"
  width={100}
  render={(_: unknown, record: AdminUserRecord) => (
    <Button type="link" style={{ paddingInline: 0 }}>
      <Link to={`/users/show/${record.id}`}>View</Link>
    </Button>
  )}
/>
```

```tsx
// admin/src/pages/users/show.tsx
import { Show, ListButton } from '@refinedev/antd';
import { Alert, Card, Col, Descriptions, Empty, Row, Space, Spin, Statistic, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { buildAdminUserDetailViewModel, loadAdminUserDetail, type AdminUserDetailRecord } from './data';
import { formatCurrency, formatDate, formatDateTime, formatRelativeTime } from '@/utils/format';
import { humanizeEnumValue } from '@/utils/api-normalizers';

const { Text, Title } = Typography;

function placeholder(value: string | null, emptyLabel: string) {
  return value && value.trim() ? value : emptyLabel;
}

export function UserShow() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminUserDetailRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('Missing user id');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    void loadAdminUserDetail(id)
      .then(setDetail)
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : 'Failed to load user';
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const view = buildAdminUserDetailViewModel({ loading, detail, error });

  if (view.kind === 'loading') {
    return <Show title="User" headerButtons={<ListButton />}> <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div> </Show>;
  }

  if (view.kind === 'error') {
    return (
      <Show title={view.title} headerButtons={<ListButton />}>
        <Alert type="error" message={view.message} showIcon />
      </Show>
    );
  }

  const { user, metrics, recent_orders } = view.detail;

  return (
    <Show title={user.full_name ?? user.email} headerButtons={<ListButton />}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={3} style={{ margin: 0 }}>{user.full_name ?? user.email}</Title>
              <Text type="secondary">{user.email}</Text>
              <div><Text>{user.phone_number ?? 'No phone provided'}</Text></div>
            </Col>
            <Col>
              <Space wrap>
                <Tag color="blue">{humanizeEnumValue(user.role)}</Tag>
                <Tag color={user.is_profile_complete ? 'green' : 'default'}>
                  {user.is_profile_complete ? 'Profile Complete' : 'Profile Incomplete'}
                </Tag>
                <Tag color={user.is_active ? 'green' : 'default'}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </Tag>
              </Space>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}><Card><Statistic title="Total Orders" value={metrics.total_orders} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="Total Spend" value={metrics.total_spend} precision={2} formatter={(value) => formatCurrency(Number(value))} /></Card></Col>
          <Col xs={24} md={8}><Card><Statistic title="Average Order Value" value={metrics.average_order_value} precision={2} formatter={(value) => formatCurrency(Number(value))} /></Card></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title="Profile Summary">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Category">{humanizeEnumValue(user.profile_category, 'No category provided')}</Descriptions.Item>
                <Descriptions.Item label="Field">{humanizeEnumValue(user.profile_field, 'No field provided')}</Descriptions.Item>
                <Descriptions.Item label="Course">{placeholder(user.course, 'No course provided')}</Descriptions.Item>
                <Descriptions.Item label="Organization">{placeholder(user.organization, 'No organization provided')}</Descriptions.Item>
                <Descriptions.Item label="Gender">{placeholder(user.gender, 'No gender provided')}</Descriptions.Item>
                <Descriptions.Item label="Date of Birth">{user.date_of_birth ? formatDate(user.date_of_birth) : 'No date of birth provided'}</Descriptions.Item>
                <Descriptions.Item label="Joined">{formatDateTime(user.created_at)}</Descriptions.Item>
                <Descriptions.Item label="Updated">{formatRelativeTime(user.updated_at)}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="Print Preferences">
              {user.printing_preferences.length === 0 ? (
                <Empty description="No print preferences yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Space wrap>
                  {user.printing_preferences.map((preference) => (
                    <Tag key={preference}>{humanizeEnumValue(preference)}</Tag>
                  ))}
                </Space>
              )}
            </Card>
          </Col>
        </Row>

        <Card title="Recent Orders">
          <Table
            rowKey="id"
            pagination={false}
            dataSource={recent_orders}
            locale={{ emptyText: 'No recent orders yet' }}
          >
            <Table.Column dataIndex="order_id" title="Order ID" />
            <Table.Column dataIndex="category" title="Category" render={(value: string) => humanizeEnumValue(value)} />
            <Table.Column dataIndex="order_status" title="Order Status" render={(value: string) => humanizeEnumValue(value)} />
            <Table.Column dataIndex="payment_status" title="Payment Status" render={(value: string) => humanizeEnumValue(value)} />
            <Table.Column dataIndex="total_price" title="Total" render={(value: number) => formatCurrency(value)} />
            <Table.Column dataIndex="created_at" title="Created" render={(value: string) => formatDateTime(value)} />
          </Table>
        </Card>
      </Space>
    </Show>
  );
}
```

- [ ] **Step 4: Run the users page tests to verify they pass**

Run: `cd /home/jd/projects/printing_app/admin && npm test -- src/pages/users/data.test.ts src/pages/users/list.test.tsx src/pages/users/show.test.tsx`

Expected: PASS with the list navigation and show page states green.

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app/admin
git add src/App.tsx src/pages/users/list.tsx src/pages/users/list.test.tsx src/pages/users/show.tsx src/pages/users/show.test.tsx src/pages/users/data.ts src/pages/users/data.test.ts src/utils/api-normalizers.ts
git commit -m "feat: add admin user show page"
```

### Task 5: Admin Users Analytics Data Contract

**Files:**
- Create: `admin/src/pages/dashboard/users-analytics.ts`
- Create: `admin/src/pages/dashboard/users-analytics.test.ts`

- [ ] **Step 1: Write the failing users analytics data tests**

```ts
import { describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/providers/api-client';
import {
  buildUsersAnalyticsViewModel,
  loadAdminUsersAnalytics,
  normalizeAdminUsersAnalytics,
} from './users-analytics';

vi.mock('@/providers/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('users analytics data', () => {
  it('loads the backend users analytics payload for the selected period', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        summary: {
          total_customers: 2,
          new_customers: 1,
          active_customers: 1,
          profile_completion_rate: 50,
          role_counts: { customers: 2, drivers: 1, admins: 0 },
        },
        signup_trend: [{ label: 'Apr 17', value: 1 }],
        profile_category_mix: [{ label: 'Student', value: 1 }],
        profile_field_mix: [{ label: 'Architecture', value: 1 }],
        top_segments: [{ label: 'Student / Architecture', value: 1 }],
        preference_mix: [{ label: 'Plotting Blueprints', value: 1 }],
        activity_split: [{ label: 'Active', value: 1 }, { label: 'Dormant', value: 1 }],
        revenue_by_segment: [{ label: 'Student / Architecture', value: 200 }],
      },
    });

    await expect(loadAdminUsersAnalytics('30D')).resolves.toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({ total_customers: 2 }),
        signup_trend: [{ label: 'Apr 17', value: 1 }],
      }),
    );
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith('/admin/users/analytics?period=30D');
  });

  it('drops malformed chart rows instead of inventing fallback analytics', () => {
    expect(
      normalizeAdminUsersAnalytics({
        summary: {
          total_customers: 2,
          new_customers: 1,
          active_customers: 1,
          profile_completion_rate: 50,
          role_counts: { customers: 2, drivers: 1, admins: 0 },
        },
        signup_trend: [{ label: 'Apr 17', value: '1' }, { bad: true }],
        profile_category_mix: [{ label: 'Student', value: 1 }],
        profile_field_mix: [],
        top_segments: [],
        preference_mix: [],
        activity_split: [],
        revenue_by_segment: [],
      }),
    ).toEqual(
      expect.objectContaining({
        signup_trend: [],
        profile_category_mix: [{ label: 'Student', value: 1 }],
      }),
    );
  });

  it('builds an inline retry view when the analytics request fails', () => {
    const view = buildUsersAnalyticsViewModel({
      loading: false,
      analytics: null,
      error: 'Failed to load users analytics',
    });

    expect(view.kind).toBe('error');
    if (view.kind !== 'error') throw new Error('Expected error view');
    expect(view.retryLabel).toBe('Retry');
    expect(view.message).toContain('Failed to load users analytics');
  });
});
```

- [ ] **Step 2: Run the analytics data test file to verify it fails**

Run: `cd /home/jd/projects/printing_app/admin && npm test -- src/pages/dashboard/users-analytics.test.ts`

Expected: FAIL with `Cannot find module './users-analytics'`.

- [ ] **Step 3: Implement the analytics normalizer and loader**

```ts
import { apiClient } from '@/providers/api-client';

export type DashboardUsersAnalyticsPeriod = '7D' | '30D' | '6M';
export type UsersAnalyticsPoint = { label: string; value: number };

export interface AdminUsersAnalyticsRecord {
  summary: {
    total_customers: number;
    new_customers: number;
    active_customers: number;
    profile_completion_rate: number;
    role_counts: {
      customers: number;
      drivers: number;
      admins: number;
    };
  };
  signup_trend: UsersAnalyticsPoint[];
  profile_category_mix: UsersAnalyticsPoint[];
  profile_field_mix: UsersAnalyticsPoint[];
  top_segments: UsersAnalyticsPoint[];
  preference_mix: UsersAnalyticsPoint[];
  activity_split: UsersAnalyticsPoint[];
  revenue_by_segment: UsersAnalyticsPoint[];
}

function normalizeSeries(value: unknown): UsersAnalyticsPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      typeof (entry as { label?: unknown }).label !== 'string' ||
      typeof (entry as { value?: unknown }).value !== 'number'
    ) {
      return [];
    }

    return [{ label: (entry as { label: string }).label, value: (entry as { value: number }).value }];
  });
}

export function normalizeAdminUsersAnalytics(payload: unknown): AdminUsersAnalyticsRecord {
  const record = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const summary = record.summary && typeof record.summary === 'object'
    ? (record.summary as Record<string, unknown>)
    : {};
  const roleCounts = summary.role_counts && typeof summary.role_counts === 'object'
    ? (summary.role_counts as Record<string, unknown>)
    : {};

  return {
    summary: {
      total_customers: typeof summary.total_customers === 'number' ? summary.total_customers : 0,
      new_customers: typeof summary.new_customers === 'number' ? summary.new_customers : 0,
      active_customers: typeof summary.active_customers === 'number' ? summary.active_customers : 0,
      profile_completion_rate: typeof summary.profile_completion_rate === 'number' ? summary.profile_completion_rate : 0,
      role_counts: {
        customers: typeof roleCounts.customers === 'number' ? roleCounts.customers : 0,
        drivers: typeof roleCounts.drivers === 'number' ? roleCounts.drivers : 0,
        admins: typeof roleCounts.admins === 'number' ? roleCounts.admins : 0,
      },
    },
    signup_trend: normalizeSeries(record.signup_trend),
    profile_category_mix: normalizeSeries(record.profile_category_mix),
    profile_field_mix: normalizeSeries(record.profile_field_mix),
    top_segments: normalizeSeries(record.top_segments),
    preference_mix: normalizeSeries(record.preference_mix),
    activity_split: normalizeSeries(record.activity_split),
    revenue_by_segment: normalizeSeries(record.revenue_by_segment),
  };
}

export async function loadAdminUsersAnalytics(
  period: DashboardUsersAnalyticsPeriod,
): Promise<AdminUsersAnalyticsRecord> {
  const response = await apiClient.get(`/admin/users/analytics?period=${period}`);
  return normalizeAdminUsersAnalytics(response.data);
}

type UsersAnalyticsState = {
  loading: boolean;
  analytics: AdminUsersAnalyticsRecord | null;
  error: string | null;
};

type UsersAnalyticsViewModel =
  | { kind: 'loading' }
  | { kind: 'ready'; analytics: AdminUsersAnalyticsRecord }
  | { kind: 'error'; message: string; retryLabel: string };

export function buildUsersAnalyticsViewModel(
  state: UsersAnalyticsState,
): UsersAnalyticsViewModel {
  if (state.loading && !state.analytics) {
    return { kind: 'loading' };
  }

  if (state.error || !state.analytics) {
    return {
      kind: 'error',
      message: state.error ?? 'Failed to load users analytics',
      retryLabel: 'Retry',
    };
  }

  return {
    kind: 'ready',
    analytics: state.analytics,
  };
}
```

- [ ] **Step 4: Run the users analytics data test file to verify it passes**

Run: `cd /home/jd/projects/printing_app/admin && npm test -- src/pages/dashboard/users-analytics.test.ts`

Expected: PASS with the loader, malformed-series, and retry tests green.

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app/admin
git add src/pages/dashboard/users-analytics.ts src/pages/dashboard/users-analytics.test.ts
git commit -m "feat: add admin users analytics data contract"
```

### Task 6: Dashboard Users Tab And Dashboard Tabs Integration

**Files:**
- Create: `admin/src/pages/dashboard/users-tab.tsx`
- Create: `admin/src/pages/dashboard/users-tab.test.tsx`
- Modify: `admin/src/pages/dashboard/index.tsx`

- [ ] **Step 1: Write the failing dashboard users tab tests**

```tsx
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { UsersTab } from './users-tab';

const { mockLoadAdminUsersAnalytics } = vi.hoisted(() => ({
  mockLoadAdminUsersAnalytics: vi.fn(),
}));

vi.mock('./users-analytics', () => ({
  loadAdminUsersAnalytics: mockLoadAdminUsersAnalytics,
  buildUsersAnalyticsViewModel: (state: any) => {
    if (state.loading && !state.analytics) return { kind: 'loading' };
    if (state.error || !state.analytics) return { kind: 'error', message: state.error ?? 'Failed', retryLabel: 'Retry' };
    return { kind: 'ready', analytics: state.analytics };
  },
}));

describe('UsersTab', () => {
  it('renders KPI cards and role counts from the backend analytics payload', async () => {
    mockLoadAdminUsersAnalytics.mockResolvedValueOnce({
      summary: {
        total_customers: 124,
        new_customers: 18,
        active_customers: 71,
        profile_completion_rate: 82,
        role_counts: { customers: 124, drivers: 8, admins: 2 },
      },
      signup_trend: [{ label: 'Apr 17', value: 4 }],
      profile_category_mix: [{ label: 'Student', value: 80 }],
      profile_field_mix: [{ label: 'Architecture', value: 32 }],
      top_segments: [{ label: 'Student / Architecture', value: 28 }],
      preference_mix: [{ label: 'Plotting Blueprints', value: 42 }],
      activity_split: [{ label: 'Active', value: 71 }, { label: 'Dormant', value: 53 }],
      revenue_by_segment: [{ label: 'Student / Architecture', value: 12840 }],
    });

    render(<UsersTab />);

    expect(await screen.findByText('Total Customers')).toBeInTheDocument();
    expect(screen.getByText('124')).toBeInTheDocument();
    expect(screen.getByText('Drivers: 8')).toBeInTheDocument();
    expect(screen.getByText('Admins: 2')).toBeInTheDocument();
  });

  it('re-requests analytics when the period changes', async () => {
    mockLoadAdminUsersAnalytics.mockResolvedValue({
      summary: {
        total_customers: 1,
        new_customers: 1,
        active_customers: 1,
        profile_completion_rate: 100,
        role_counts: { customers: 1, drivers: 0, admins: 0 },
      },
      signup_trend: [],
      profile_category_mix: [],
      profile_field_mix: [],
      top_segments: [],
      preference_mix: [],
      activity_split: [],
      revenue_by_segment: [],
    });

    render(<UsersTab />);

    expect(await screen.findByText('Total Customers')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '30D' }));

    await waitFor(() => {
      expect(mockLoadAdminUsersAnalytics).toHaveBeenLastCalledWith('30D');
    });
  });
});
```

- [ ] **Step 2: Run the dashboard users tab tests to verify they fail**

Run: `cd /home/jd/projects/printing_app/admin && npm test -- src/pages/dashboard/users-tab.test.tsx`

Expected: FAIL with `Cannot find module './users-tab'`.

- [ ] **Step 3: Implement the users tab and integrate it into the dashboard**

```tsx
// admin/src/pages/dashboard/users-tab.tsx
import { Alert, Card, Col, Empty, Radio, Row, Space, Spin, Statistic, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

import {
  buildUsersAnalyticsViewModel,
  loadAdminUsersAnalytics,
  type AdminUsersAnalyticsRecord,
  type DashboardUsersAnalyticsPeriod,
} from './users-analytics';
import { formatCurrency } from '@/utils/format';

const { Text } = Typography;

function SimpleBarChart({
  title,
  emptyLabel,
  data,
  color,
  valueFormatter,
}: {
  title: string;
  emptyLabel: string;
  data: { label: string; value: number }[];
  color: string;
  valueFormatter?: (value: number) => string;
}) {
  return (
    <Card
      title={<Text style={{ color: '#F0F0F0', fontWeight: 600 }}>{title}</Text>}
      style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}
      styles={{ header: { borderBottom: '1px solid #2E2E2E' } }}
    >
      {data.length === 0 ? (
        <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#808080' }}>{emptyLabel}</span>} />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
            <XAxis dataKey="label" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
            <Tooltip formatter={(value: number) => valueFormatter ? valueFormatter(value) : value} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

export function UsersTab() {
  const [period, setPeriod] = useState<DashboardUsersAnalyticsPeriod>('7D');
  const [analytics, setAnalytics] = useState<AdminUsersAnalyticsRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    void loadAdminUsersAnalytics(period)
      .then(setAnalytics)
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : 'Failed to load users analytics';
        setError(message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, [period]);

  const view = buildUsersAnalyticsViewModel({ loading, analytics, error });

  if (view.kind === 'loading') {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (view.kind === 'error') {
    return (
      <Alert
        type="error"
        showIcon
        message={view.message}
        action={<a onClick={refresh}>{view.retryLabel}</a>}
      />
    );
  }

  const { summary } = view.analytics;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Row justify="space-between" align="middle">
        <Col>
          <Radio.Group value={period} onChange={(event) => setPeriod(event.target.value)}>
            <Radio.Button value="7D">7D</Radio.Button>
            <Radio.Button value="30D">30D</Radio.Button>
            <Radio.Button value="6M">6M</Radio.Button>
          </Radio.Group>
        </Col>
        <Col>
          <Space>
            <Text style={{ color: '#808080' }}>Drivers: {summary.role_counts.drivers}</Text>
            <Text style={{ color: '#808080' }}>Admins: {summary.role_counts.admins}</Text>
          </Space>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={6}><Card style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}><Statistic title="Total Customers" value={summary.total_customers} /></Card></Col>
        <Col xs={24} md={12} xl={6}><Card style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}><Statistic title="New Customers" value={summary.new_customers} /></Card></Col>
        <Col xs={24} md={12} xl={6}><Card style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}><Statistic title="Profile Completion" value={summary.profile_completion_rate} suffix="%" /></Card></Col>
        <Col xs={24} md={12} xl={6}><Card style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}><Statistic title="Active Customers" value={summary.active_customers} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}><SimpleBarChart title="Signup Trend" emptyLabel="No signups in this period" data={view.analytics.signup_trend} color="#FFDE58" /></Col>
        <Col xs={24} xl={12}><SimpleBarChart title="Profile Category Mix" emptyLabel="No profile category data yet" data={view.analytics.profile_category_mix} color="#42A5F5" /></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}><SimpleBarChart title="Field Mix" emptyLabel="No field mix data yet" data={view.analytics.profile_field_mix} color="#34d399" /></Col>
        <Col xs={24} xl={12}><SimpleBarChart title="Top Segments" emptyLabel="No segment data yet" data={view.analytics.top_segments} color="#f59e0b" /></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}><SimpleBarChart title="Preference Mix" emptyLabel="No preferences yet" data={view.analytics.preference_mix} color="#8b5cf6" /></Col>
        <Col xs={24} xl={8}><SimpleBarChart title="Dormant vs Active" emptyLabel="No activity data yet" data={view.analytics.activity_split} color="#ef4444" /></Col>
        <Col xs={24} xl={8}><SimpleBarChart title="Revenue By Segment" emptyLabel="No paid revenue yet" data={view.analytics.revenue_by_segment} color="#10b981" valueFormatter={(value) => formatCurrency(value)} /></Col>
      </Row>
    </Space>
  );
}
```

```tsx
// admin/src/pages/dashboard/index.tsx
import { Tabs } from 'antd';
import { UsersTab } from './users-tab';

const operationsTab = (
  <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Row gutter={[16, 16]}>
      <Col xs={12} lg={6}>
        <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={3} style={{ color: '#F0F0F0', margin: '0 0 4px 0' }}>{kpis.new_orders_count}</Title>
              <Text style={{ color: '#808080', fontSize: 13 }}>New Orders</Text>
            </div>
            <div style={{ background: 'rgba(66, 165, 245, 0.12)', padding: 10, borderRadius: 10 }}>
              <FileTextOutlined style={{ color: '#42A5F5', fontSize: 20 }} />
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={3} style={{ color: '#F0F0F0', margin: '0 0 4px 0' }}>{kpis.in_production_count}</Title>
              <Text style={{ color: '#808080', fontSize: 13 }}>In Production</Text>
            </div>
            <div style={{ background: 'rgba(255, 202, 40, 0.12)', padding: 10, borderRadius: 10 }}>
              <PrinterOutlined style={{ color: '#FFCA28', fontSize: 20 }} />
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={3} style={{ color: '#F0F0F0', margin: '0 0 4px 0' }}>{kpis.ready_for_pickup_count}</Title>
              <Text style={{ color: '#808080', fontSize: 13 }}>Ready For Pickup</Text>
            </div>
            <div style={{ background: 'rgba(102, 187, 106, 0.12)', padding: 10, borderRadius: 10 }}>
              <DropboxOutlined style={{ color: '#66BB6A', fontSize: 20 }} />
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={12} lg={6}>
        <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Title level={3} style={{ color: '#F0F0F0', margin: '0 0 4px 0' }}>{kpis.delivered_count}</Title>
              <Text style={{ color: '#808080', fontSize: 13 }}>Delivered</Text>
            </div>
            <div style={{ background: 'rgba(102, 187, 106, 0.12)', padding: 10, borderRadius: 10 }}>
              <CheckCircleOutlined style={{ color: '#66BB6A', fontSize: 20 }} />
            </div>
          </div>
        </Card>
      </Col>
    </Row>

    <Card
      title={<Text style={{ color: '#F0F0F0', fontWeight: 600, fontSize: 15 }}>Recent Orders</Text>}
      style={cardStyle}
      styles={{ header: { borderBottom: '1px solid #2E2E2E' } }}
    >
      <Table<Order>
        dataSource={recentOrders}
        rowKey="id"
        pagination={false}
        size="small"
      >
        <Table.Column<Order>
          dataIndex="order_id"
          title="Order"
          render={(value: string) => (
            <span style={{ fontFamily: 'monospace', color: '#F0F0F0', fontWeight: 500 }}>{value}</span>
          )}
        />
        <Table.Column<Order>
          dataIndex="category"
          title="Type"
          render={(value: string) => (
            <Tag color={value === 'paper' ? 'blue' : 'purple'}>
              {value === 'paper' ? 'Paper' : '3D'}
            </Tag>
          )}
        />
        <Table.Column<Order>
          dataIndex="order_status"
          title="Status"
          render={(status: OrderStatus) => <StatusBadge status={status} />}
        />
        <Table.Column<Order>
          dataIndex="created_at"
          title="When"
          render={(value: string) => formatRelativeTime(value)}
        />
      </Table>
    </Card>
  </Space>
);

const ordersTab = (
  <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Row justify="space-between" align="middle">
      <Col>
        <Title level={4} style={{ color: '#F0F0F0', margin: 0 }}>Orders Analytics</Title>
      </Col>
      <Col>
        <Space size={16}>
          <Radio.Group
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            size="small"
            buttonStyle="solid"
          >
            <Radio.Button value="7D">7D</Radio.Button>
            <Radio.Button value="30D">30D</Radio.Button>
            <Radio.Button value="6M">6M</Radio.Button>
          </Radio.Group>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            style={{ background: '#FFDE58', color: '#141414', border: 'none', fontWeight: 600, borderRadius: 8 }}
            onClick={() => {
              const csvHeader = 'Order_ID,Status,Created_At,Total_Price\n';
              const csvRows = allOrders
                .map((order) => `${order.order_id},${order.order_status},${order.created_at},${order.total_price}`)
                .join('\n');
              const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = `Master_Export_${new Date().toISOString().slice(0, 10)}.csv`;
              anchor.click();
            }}
          >
            Master CSV Export
          </Button>
        </Space>
      </Col>
    </Row>

    <Card style={cardStyle} styles={{ body: { padding: 24 } }}>
      <Row justify="space-between" align="middle">
        <Col style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              background: 'rgba(255, 222, 88, 0.15)',
              padding: '14px 18px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ClockCircleOutlined style={{ color: '#FFDE58', fontSize: 26 }} />
          </div>
          <div>
            <Text style={{ color: '#808080', fontSize: 13, display: 'block', marginBottom: 4 }}>
              Average Turnaround Time (TAT)
            </Text>
            <Title level={2} style={{ color: '#F0F0F0', margin: 0, letterSpacing: '-0.5px' }}>
              {Math.floor((kpis.avg_tat_mins || 0) / 60)}h {(kpis.avg_tat_mins || 0) % 60}m
            </Title>
          </div>
        </Col>
        <Col>
          <div
            style={{
              background: 'rgba(52, 211, 153, 0.1)',
              padding: '6px 14px',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ArrowUpOutlined style={{ color: '#34d399', fontSize: 13 }} />
            <Text style={{ color: '#34d399', fontWeight: 600, fontSize: 14 }}>12% Faster</Text>
          </div>
        </Col>
      </Row>
    </Card>

    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <TatTrendChart data={effectiveAnalytics.tatTrend || []} />
      </Col>
      <Col xs={24} lg={12}>
        <OrderVolumeChart data={effectiveAnalytics.volume} />
      </Col>
    </Row>

    <PaperSizeDemandChart data={effectiveAnalytics.paperSizeDemand} />
  </Space>
);

return (
  <ErrorBoundary>
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: '#F0F0F0', margin: 0 }}>Dashboard</Title>
        <Text style={{ color: '#808080', fontSize: 13, display: 'block', marginBottom: 20 }}>
          Welcome back, Admin
        </Text>
      </div>

      <Tabs
        defaultActiveKey="operations"
        items={[
          { key: 'operations', label: 'Operations', children: operationsTab },
          { key: 'orders', label: 'Orders', children: ordersTab },
          { key: 'users', label: 'Users', children: <UsersTab /> },
        ]}
      />
    </div>
  </ErrorBoundary>
);
```

- [ ] **Step 4: Run the dashboard tests to verify they pass**

Run: `cd /home/jd/projects/printing_app/admin && npm test -- src/pages/dashboard/users-analytics.test.ts src/pages/dashboard/users-tab.test.tsx`

Expected: PASS with users analytics data and users tab UI green.

- [ ] **Step 5: Commit**

```bash
cd /home/jd/projects/printing_app/admin
git add src/pages/dashboard/users-analytics.ts src/pages/dashboard/users-analytics.test.ts src/pages/dashboard/users-tab.tsx src/pages/dashboard/users-tab.test.tsx src/pages/dashboard/index.tsx
git commit -m "feat: add admin users dashboard tab"
```

## Final Verification

- Run backend verification:

```bash
cd /home/jd/projects/printing_app/server
npm test -- admin/user-insights.spec.ts admin/admin.controller.spec.ts --runInBand
npm run build
```

Expected:
- Jest passes for new admin detail and analytics coverage.
- `nest build` succeeds.

- Run admin verification:

```bash
cd /home/jd/projects/printing_app/admin
npm test -- src/pages/users/data.test.ts src/pages/users/list.test.tsx src/pages/users/show.test.tsx src/pages/dashboard/users-analytics.test.ts src/pages/dashboard/users-tab.test.tsx
npm run build
```

Expected:
- Vitest passes for new data, show page, list navigation, and dashboard users tab.
- `tsc && vite build` succeeds.

- Run manual smoke flow with the seeded admin account:

```bash
cd /home/jd/projects/printing_app/server
npm run start:dev
```

```bash
cd /home/jd/projects/printing_app/admin
npm run dev
```

Expected manual checks:
- log in as `admin@gridprint.ph`
- open `/users`
- click `View` on a customer row
- confirm hero summary, quick metrics, profile summary, and recent orders render
- open the dashboard and switch to the `Users` tab
- change `7D`, `30D`, and `6M`
- confirm charts refresh and the page shows inline errors instead of fake analytics when the endpoint is unavailable

## Self-Review

- Spec coverage:
  - dedicated user show page: Task 4
  - explicit list navigation into show: Task 4
  - backend detail endpoint: Tasks 1-2
  - backend users analytics endpoint: Tasks 1-2
  - dashboard `Users` tab: Tasks 5-6
  - sparse profile placeholders: Task 4
  - no fake analytics fallback: Tasks 5-6
  - customer-focused metrics with supporting driver/admin counts: Tasks 1 and 6

- Placeholder scan:
  - no `TODO`, `TBD`, `implement later`, or `similar to Task N` markers remain
  - every task includes an exact file set, code blocks, commands, and expected outcomes

- Type consistency:
  - backend period type is `UserInsightsPeriod`
  - frontend period type is `DashboardUsersAnalyticsPeriod`
  - backend response uses snake_case keys and frontend normalizers explicitly map them
  - show page uses `AdminUserDetailRecord`, not raw API payloads
