import { Order } from '../orders/entities/order.entity';
import { User, UserRole } from '../users/entities/user.entity';

export type UserInsightsPeriod = '7D' | '30D' | '6M';

type LabelValue = {
  label: string;
  value: number;
};

type SummaryPayload = {
  total_customers: number;
  new_customers: number;
  active_customers: number;
  dormant_customers: number;
  profile_completion_rate: number;
  total_orders: number;
  paid_orders: number;
  total_revenue: number;
  average_order_value: number;
};

type AdminUserInsightOrderPayload = {
  id: number;
  order_id: string;
  user_id: number;
  category: string;
  file_url: string | null;
  file_name: string | null;
  quantity: number;
  total_price: number;
  delivery_fee: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  delivery_option: string;
  admin_notes: string | null;
  decline_reason: string | null;
  cancellation_reason: string | null;
  estimated_completion_at: Date | null;
  assigned_rider_id: number | null;
  created_at: Date;
  updated_at: Date;
};

/** Supplier shop fields as shown on admin/super user detail (self-edited). */
export type AdminSupplierProfileSnapshot = {
  id: number;
  user_id: number;
  business_name: string;
  description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  logo_file_id: number | null;
  logo_url: string | null;
  attributes: Record<string, string>;
  service_zones: string[];
  is_active: boolean;
  verification_status: string | null;
  capabilities: Array<{
    id: number;
    product_family: string;
    materials: string[];
    max_capacity: number;
    lead_time_days: number;
  }>;
  updated_at: Date;
};

export type AdminUserDetailPayload = {
  user: {
    id: number;
    email: string;
    full_name: string | null;
    phone_number: string | null;
    gender: string | null;
    date_of_birth: Date | null;
    profile_category: string | null;
    profile_field: string | null;
    course: string | null;
    organization: string | null;
    printing_preferences: string[];
    role: string;
    is_active: boolean;
    is_profile_complete: boolean;
    created_at: Date;
    updated_at: Date;
  };
  metrics: {
    total_orders: number;
    paid_orders: number;
    total_spend: number;
    average_order_value: number;
    last_order_at: Date | null;
    last_paid_order_at: Date | null;
  };
  recent_orders: AdminUserInsightOrderPayload[];
  /** Present when the user has a supplier_profiles row (role may still differ). */
  supplier_profile: AdminSupplierProfileSnapshot | null;
};

export type AdminUsersAnalyticsPayload = {
  summary: SummaryPayload;
  signup_trend: LabelValue[];
  profile_category_mix: LabelValue[];
  profile_field_mix: LabelValue[];
  top_segments: LabelValue[];
  preference_mix: LabelValue[];
  activity_split: LabelValue[];
  revenue_by_segment: LabelValue[];
};

type Bucket = {
  key: string;
  label: string;
  start: Date;
};

const PAID_STATUS = 'paid';
const CUSTOMER_ROLE = UserRole.CLIENT;

const PROFILE_CATEGORY_LABELS: Record<string, string> = {
  student: 'Student',
  professional: 'Professional',
};

const PROFILE_FIELD_LABELS: Record<string, string> = {
  architecture: 'Architecture',
  engineering: 'Engineering',
  medical_nursing: 'Medical Nursing',
  law_arts_others: 'Law Arts Others',
  architect_designer: 'Architect Designer',
  engineer_contractor: 'Engineer Contractor',
  medical_professional: 'Medical Professional',
  business_corporate: 'Business Corporate',
};

const PRINTING_PREFERENCE_LABELS: Record<string, string> = {
  plotting_blueprints: 'Plotting Blueprints',
  technical_specs: 'Technical Specs',
  high_res_color: 'High Res Color',
  document_printing: 'Document Printing',
  marketing_materials: 'Marketing Materials',
};

export function normalizeUserInsightsPeriod(
  period?: string,
): UserInsightsPeriod {
  return period === '7D' || period === '30D' || period === '6M'
    ? period
    : '30D';
}

export function buildAdminUserDetailPayload(
  user: User,
  orders: Order[],
  supplierProfile: AdminSupplierProfileSnapshot | null = null,
): AdminUserDetailPayload {
  const scopedOrders = orders.filter((order) => order.userId === user.id);
  const ordered = [...scopedOrders].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id,
  );
  const paidOrders = ordered.filter(isPaidOrder);
  const paidSpend = paidOrders.reduce(
    (sum, order) => sum + numberOrZero(order.totalPrice),
    0,
  );

  return {
    user: {
      id: user.id,
      email: user.email,
      full_name: user.fullName ?? null,
      phone_number: user.phoneNumber ?? null,
      gender: user.gender ?? null,
      date_of_birth: user.dateOfBirth ?? null,
      profile_category: user.profileCategory ?? null,
      profile_field: user.profileField ?? null,
      course: user.course ?? null,
      organization: user.organization ?? null,
      printing_preferences: user.printingPreferences ?? [],
      role: user.role,
      is_active: user.isActive,
      is_profile_complete: user.isProfileComplete,
      created_at: user.createdAt,
      updated_at: user.updatedAt,
    },
    metrics: {
      total_orders: scopedOrders.length,
      paid_orders: paidOrders.length,
      total_spend: paidSpend,
      average_order_value: paidOrders.length
        ? paidSpend / paidOrders.length
        : 0,
      last_order_at: ordered[0]?.createdAt ?? null,
      last_paid_order_at: paidOrders[0]?.createdAt ?? null,
    },
    recent_orders: ordered.slice(0, 5).map(mapAdminInsightOrder),
    supplier_profile: supplierProfile,
  };
}

export function buildAdminUsersAnalyticsPayload(
  users: User[],
  orders: Order[],
  period: UserInsightsPeriod,
  now = new Date(),
): AdminUsersAnalyticsPayload {
  const customers = users.filter(isCustomer);
  const customerById = new Map(customers.map((user) => [user.id, user]));
  const periodStart = getPeriodStart(period, now);
  const periodEnd = now.getTime();
  const periodOrders = orders.filter((order) => {
    const customer = customerById.get(order.userId);
    const createdAt = order.createdAt.getTime();

    return (
      Boolean(customer) &&
      createdAt >= periodStart.getTime() &&
      createdAt <= periodEnd
    );
  });

  const activeCustomerIds = new Set<number>(
    periodOrders.map((order) => order.userId),
  );
  const totalRevenue = periodOrders
    .filter(isPaidOrder)
    .reduce((sum, order) => sum + numberOrZero(order.totalPrice), 0);
  const paidOrders = periodOrders.filter(isPaidOrder).length;
  const totalOrders = periodOrders.length;

  const summary: SummaryPayload = {
    total_customers: customers.length,
    new_customers: customers.filter((user) => {
      const createdAt = user.createdAt.getTime();
      return createdAt >= periodStart.getTime() && createdAt <= periodEnd;
    }).length,
    active_customers: activeCustomerIds.size,
    dormant_customers: Math.max(0, customers.length - activeCustomerIds.size),
    profile_completion_rate: customers.length
      ? Math.round(
          (customers.filter((user) => user.isProfileComplete).length /
            customers.length) *
            100,
        )
      : 0,
    total_orders: totalOrders,
    paid_orders: paidOrders,
    total_revenue: totalRevenue,
    average_order_value: paidOrders ? totalRevenue / paidOrders : 0,
  };

  return {
    summary,
    signup_trend: buildSignupTrend(customers, period, now),
    profile_category_mix: buildCategoryMix(customers),
    profile_field_mix: buildFieldMix(customers),
    top_segments: buildTopSegments(customers),
    preference_mix: buildPreferenceMix(customers),
    activity_split: [
      { label: 'Active', value: summary.active_customers },
      { label: 'Dormant', value: summary.dormant_customers },
    ],
    revenue_by_segment: buildRevenueBySegment(customers, periodOrders),
  };
}

function isCustomer(user: User) {
  return user.role === CUSTOMER_ROLE;
}

function isPaidOrder(order: Order) {
  return order.paymentStatus === PAID_STATUS;
}

function numberOrZero(value: number | string | null | undefined) {
  return value == null ? 0 : Number(value);
}

function mapAdminInsightOrder(order: Order): AdminUserInsightOrderPayload {
  return {
    id: order.id,
    order_id: order.orderId,
    user_id: order.userId,
    category: order.category,
    file_url: order.fileUrl ?? null,
    file_name: order.fileName ?? null,
    quantity: order.quantity,
    total_price: numberOrZero(order.totalPrice),
    delivery_fee: numberOrZero(order.deliveryFee),
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    order_status: order.orderStatus,
    delivery_option: order.deliveryOption,
    admin_notes: order.adminNotes ?? null,
    decline_reason: order.declineReason ?? null,
    cancellation_reason: order.cancellationReason ?? null,
    estimated_completion_at: order.estimatedCompletionAt ?? null,
    assigned_rider_id: order.assignedRiderId ?? null,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

function buildSignupTrend(
  customers: User[],
  period: UserInsightsPeriod,
  now: Date,
): LabelValue[] {
  const buckets = buildBuckets(period, now);
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));

  for (const user of customers) {
    const createdAt = user.createdAt.getTime();

    if (createdAt < buckets[0]?.start.getTime() || createdAt > now.getTime()) {
      continue;
    }

    const bucketKey = getBucketKey(user.createdAt, period);
    if (counts.has(bucketKey)) {
      counts.set(bucketKey, (counts.get(bucketKey) ?? 0) + 1);
    }
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    value: counts.get(bucket.key) ?? 0,
  }));
}

function buildCategoryMix(customers: User[]): LabelValue[] {
  return buildCountMix(customers, (user) =>
    humanizeProfileCategory(user.profileCategory),
  );
}

function buildFieldMix(customers: User[]): LabelValue[] {
  return buildCountMix(customers, (user) =>
    humanizeProfileField(user.profileField),
  );
}

function buildPreferenceMix(customers: User[]): LabelValue[] {
  const counts = new Map<string, number>();

  for (const user of customers) {
    for (const preference of user.printingPreferences ?? []) {
      const label = humanizePrintingPreference(preference);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return sortLabelValueEntries(counts);
}

function buildTopSegments(customers: User[]): LabelValue[] {
  const counts = new Map<string, number>();

  for (const user of customers) {
    const label = humanizeSegment(user);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return sortLabelValueEntries(counts);
}

function buildRevenueBySegment(
  customers: User[],
  orders: Order[],
): LabelValue[] {
  const customerById = new Map(customers.map((user) => [user.id, user]));
  const counts = new Map<string, number>();

  for (const order of orders) {
    if (!isPaidOrder(order)) {
      continue;
    }

    const customer = customerById.get(order.userId);
    if (!customer) {
      continue;
    }

    const label = humanizeSegment(customer);
    counts.set(
      label,
      (counts.get(label) ?? 0) + numberOrZero(order.totalPrice),
    );
  }

  return sortLabelValueEntries(counts);
}

function buildCountMix(
  customers: User[],
  getLabel: (user: User) => string,
): LabelValue[] {
  const counts = new Map<string, number>();

  for (const user of customers) {
    const label = getLabel(user);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return sortLabelValueEntries(counts);
}

function sortLabelValueEntries(counts: Map<string, number>): LabelValue[] {
  return [...counts.entries()]
    .sort(([leftLabel, leftValue], [rightLabel, rightValue]) => {
      if (rightValue !== leftValue) {
        return rightValue - leftValue;
      }

      return leftLabel.localeCompare(rightLabel);
    })
    .map(([label, value]) => ({ label, value }));
}

function humanizeProfileCategory(value: User['profileCategory']): string {
  if (!value) {
    return 'Uncategorized';
  }

  return PROFILE_CATEGORY_LABELS[value] ?? humanizeEnumValue(value);
}

function humanizeProfileField(value: User['profileField']): string {
  if (!value) {
    return 'Unspecified';
  }

  return PROFILE_FIELD_LABELS[value] ?? humanizeEnumValue(value);
}

function humanizePrintingPreference(
  value: NonNullable<User['printingPreferences']>[number],
): string {
  return PRINTING_PREFERENCE_LABELS[value] ?? humanizeEnumValue(value);
}

function humanizeSegment(user: User): string {
  const category = humanizeProfileCategory(user.profileCategory);
  const field = humanizeProfileField(user.profileField);

  if (category === 'Uncategorized' && field === 'Unspecified') {
    return 'Uncategorized';
  }

  return `${category} / ${field}`;
}

function humanizeEnumValue(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getPeriodStart(period: UserInsightsPeriod, now: Date) {
  const buckets = buildBuckets(period, now);
  return buckets[0]?.start ?? now;
}

function buildBuckets(period: UserInsightsPeriod, now: Date): Bucket[] {
  if (period === '6M') {
    return buildMonthlyBuckets(now, 6);
  }

  return buildDailyBuckets(now, period === '7D' ? 7 : 30);
}

function buildDailyBuckets(now: Date, days: number): Bucket[] {
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

function buildMonthlyBuckets(now: Date, months: number): Bucket[] {
  const currentMonth = startOfUtcMonth(now);
  const start = addUtcMonths(currentMonth, -(months - 1));

  return Array.from({ length: months }, (_, index) => {
    const date = addUtcMonths(start, index);
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
        2,
        '0',
      )}`,
      label: formatMonthLabel(date),
      start: date,
    };
  });
}

function getBucketKey(date: Date, period: UserInsightsPeriod) {
  if (period === '6M') {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
      2,
      '0',
    )}`;
  }

  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
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
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  );
}

function formatDayLabel(date: Date) {
  const monthLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return `${monthLabels[date.getUTCMonth()]} ${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;
}

function formatMonthLabel(date: Date) {
  const monthLabels = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  return monthLabels[date.getUTCMonth()];
}
