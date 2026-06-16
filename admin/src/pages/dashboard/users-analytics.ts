import { apiClient } from "@/providers/api-client";

export type DashboardUsersAnalyticsPeriod = "7D" | "30D" | "6M";

export type AdminUsersAnalyticsPoint = {
  label: string;
  value: number;
};

type AdminUsersAnalyticsRoleCounts = {
  customers: number;
  riders: number;
  admins: number;
};

type AdminUsersAnalyticsSummary = {
  total_customers: number;
  new_customers: number;
  active_customers: number;
  profile_completion_rate: number;
  role_counts: AdminUsersAnalyticsRoleCounts;
};

export type AdminUsersAnalyticsRecord = {
  summary: AdminUsersAnalyticsSummary;
  signup_trend: AdminUsersAnalyticsPoint[];
  profile_category_mix: AdminUsersAnalyticsPoint[];
  profile_field_mix: AdminUsersAnalyticsPoint[];
  top_segments: AdminUsersAnalyticsPoint[];
  preference_mix: AdminUsersAnalyticsPoint[];
  activity_split: AdminUsersAnalyticsPoint[];
  revenue_by_segment: AdminUsersAnalyticsPoint[];
};

export type AdminUsersAnalyticsState = {
  loading: boolean;
  analytics: AdminUsersAnalyticsRecord | null;
  error: string | null;
};

export type UsersAnalyticsViewModel =
  | { kind: "loading" }
  | { kind: "error"; message: string; retryLabel: "Retry" }
  | { kind: "ready"; analytics: AdminUsersAnalyticsRecord };

const REQUIRED_SERIES_KEYS = [
  "signup_trend",
  "profile_category_mix",
  "profile_field_mix",
  "top_segments",
  "preference_mix",
  "activity_split",
  "revenue_by_segment",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function normalizeCount(value: unknown): number | null {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function normalizePercentage(value: unknown): number | null {
  if (value == null) {
    return 0;
  }

  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function normalizePointSeries(value: unknown): AdminUsersAnalyticsPoint[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const points: AdminUsersAnalyticsPoint[] = [];

  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as { label?: unknown }).label !== "string"
    ) {
      continue;
    }

    const rawValue = (entry as { value?: unknown }).value;
    if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
      continue;
    }

    if (rawValue < 0) {
      return null;
    }

    points.push({
      label: (entry as { label: string }).label,
      value: rawValue,
    });
  }

  return points;
}

export function normalizeAdminUsersAnalytics(payload: unknown): AdminUsersAnalyticsRecord | null {
  if (!isRecord(payload) || !isRecord(payload.summary)) {
    return null;
  }

  for (const key of REQUIRED_SERIES_KEYS) {
    if (!(key in payload) || !Array.isArray(payload[key])) {
      return null;
    }
  }

  const summary = payload.summary;
  const roleCounts = isRecord(summary.role_counts) ? summary.role_counts : {};

  const totalCustomers = normalizeCount(summary.total_customers);
  const newCustomers = normalizeCount(summary.new_customers);
  const activeCustomers = normalizeCount(summary.active_customers);
  const profileCompletionRate = normalizePercentage(summary.profile_completion_rate);
  const customers = normalizeCount(roleCounts.customers);
  const riders = normalizeCount(roleCounts.riders);
  const admins = normalizeCount(roleCounts.admins);

  if (
    totalCustomers === null ||
    newCustomers === null ||
    activeCustomers === null ||
    profileCompletionRate === null ||
    customers === null ||
    riders === null ||
    admins === null
  ) {
    return null;
  }

  const signupTrend = normalizePointSeries(payload.signup_trend);
  const profileCategoryMix = normalizePointSeries(payload.profile_category_mix);
  const profileFieldMix = normalizePointSeries(payload.profile_field_mix);
  const topSegments = normalizePointSeries(payload.top_segments);
  const preferenceMix = normalizePointSeries(payload.preference_mix);
  const activitySplit = normalizePointSeries(payload.activity_split);
  const revenueBySegment = normalizePointSeries(payload.revenue_by_segment);

  if (
    signupTrend === null ||
    profileCategoryMix === null ||
    profileFieldMix === null ||
    topSegments === null ||
    preferenceMix === null ||
    activitySplit === null ||
    revenueBySegment === null
  ) {
    return null;
  }

  return {
    summary: {
      total_customers: totalCustomers,
      new_customers: newCustomers,
      active_customers: activeCustomers,
      profile_completion_rate: profileCompletionRate,
      role_counts: {
        customers,
        riders,
        admins,
      },
    },
    signup_trend: signupTrend,
    profile_category_mix: profileCategoryMix,
    profile_field_mix: profileFieldMix,
    top_segments: topSegments,
    preference_mix: preferenceMix,
    activity_split: activitySplit,
    revenue_by_segment: revenueBySegment,
  };
}

export async function loadAdminUsersAnalytics(
  period: DashboardUsersAnalyticsPeriod,
): Promise<AdminUsersAnalyticsRecord | null> {
  const response = await apiClient.get(`/admin/users/analytics?period=${period}`);
  return normalizeAdminUsersAnalytics(response.data);
}

export function buildUsersAnalyticsViewModel(
  state: AdminUsersAnalyticsState,
): UsersAnalyticsViewModel {
  if (state.loading) {
    return { kind: "loading" };
  }

  if (state.error || !state.analytics) {
    return {
      kind: "error",
      message: state.error ?? "Unable to load users analytics",
      retryLabel: "Retry",
    };
  }

  return {
    kind: "ready",
    analytics: state.analytics,
  };
}
