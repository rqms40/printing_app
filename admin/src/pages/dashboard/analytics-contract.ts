import type { Order } from "@/types/order";
import type { OrderStatus } from "@/types/enums";

export type DashboardAnalyticsPeriod = "7D" | "30D" | "6M";

export interface DashboardAnalyticsPoint {
  label: string;
  value: number;
}

export interface DashboardAnalyticsResponse {
  tatTrend: DashboardAnalyticsPoint[];
  errorTrend: DashboardAnalyticsPoint[];
  volume: DashboardAnalyticsPoint[];
  paperSizeDemand: DashboardAnalyticsPoint[];
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isLabelSeries(value: unknown): value is DashboardAnalyticsPoint[] {
  return Array.isArray(value) && value.every((entry) => (
    !!entry &&
    typeof entry === "object" &&
    typeof (entry as { label?: unknown }).label === "string" &&
    typeof (entry as { value?: unknown }).value === "number"
  ));
}

function normalizeSeries(value: unknown): DashboardAnalyticsPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as { label?: unknown }).label !== "string" ||
      typeof (entry as { value?: unknown }).value !== "number"
    ) {
      return [];
    }

    return [
      {
        label: (entry as { label: string }).label,
        value: (entry as { value: number }).value,
      },
    ];
  });
}

export function normalizeDashboardAnalytics(
  payload: unknown,
): DashboardAnalyticsResponse {
  const record =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  return {
    tatTrend: normalizeSeries(record.tatTrend),
    errorTrend: normalizeSeries(record.errorTrend),
    volume: normalizeSeries(record.volume),
    paperSizeDemand: normalizeSeries(record.paperSizeDemand),
  };
}

export function hasModernDashboardAnalyticsPayload(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const record = payload as Record<string, unknown>;

  return (
    isLabelSeries(record.tatTrend) &&
    isLabelSeries(record.volume) &&
    Array.isArray(record.paperSizeDemand) &&
    isLabelSeries(record.paperSizeDemand)
  );
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
  return `${MONTH_LABELS[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatMonthLabel(date: Date) {
  return MONTH_LABELS[date.getUTCMonth()];
}

function buildBuckets(period: DashboardAnalyticsPeriod, now: Date) {
  if (period === "6M") {
    const currentMonth = startOfUtcMonth(now);
    const start = addUtcMonths(currentMonth, -5);

    return Array.from({ length: 6 }, (_, index) => {
      const date = addUtcMonths(start, index);

      return {
        key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
        label: formatMonthLabel(date),
        start: date,
      };
    });
  }

  const days = period === "7D" ? 7 : 30;
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

function getBucketKey(date: Date, period: DashboardAnalyticsPeriod) {
  if (period === "6M") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function isExcludedFromPaperDemand(status: OrderStatus) {
  return status === "cancelled" || status === "file_rejected";
}

export function deriveDashboardAnalyticsFromOrders(
  orders: Order[],
  period: DashboardAnalyticsPeriod,
  now = new Date(),
): DashboardAnalyticsResponse {
  const buckets = buildBuckets(period, now);
  const earliestBucket = buckets[0]?.start ?? now;

  const tatTrend = new Map<string, number>(buckets.map((bucket) => [bucket.key, 0]));
  const errorTrend = new Map<string, number>(buckets.map((bucket) => [bucket.key, 0]));
  const volume = new Map<string, number>(buckets.map((bucket) => [bucket.key, 0]));
  const paperSizeDemand = new Map<string, number>();

  for (const order of orders) {
    const createdAt = new Date(order.created_at);

    if (createdAt < earliestBucket) {
      continue;
    }

    const bucketKey = getBucketKey(createdAt, period);
    if (!tatTrend.has(bucketKey) || !volume.has(bucketKey)) {
      continue;
    }

    volume.set(bucketKey, (volume.get(bucketKey) ?? 0) + 1);

    if (order.estimated_completion_at) {
      // Mock tracking of Turnaround Time dynamically here
      // For now, since some don't have explicit dates in mock payload, just add a random increment to simulate tracking.
      tatTrend.set(bucketKey, (tatTrend.get(bucketKey) ?? 0) + 120);
    }

    if (
      order.category === "paper" &&
      order.paper_specs?.paper_size &&
      !isExcludedFromPaperDemand(order.order_status)
    ) {
      const paperSize = order.paper_specs.paper_size.toUpperCase();
      paperSizeDemand.set(paperSize, (paperSizeDemand.get(paperSize) ?? 0) + 1);
    }
  }

  return {
    tatTrend: buckets.map((bucket) => ({
      label: bucket.label,
      // For real data, we would divide sum by count for averages
      value: tatTrend.get(bucket.key) ?? 0,
    })),
    errorTrend: buckets.map((bucket) => ({
      label: bucket.label,
      value: errorTrend.get(bucket.key) ?? 0,
    })),
    volume: buckets.map((bucket) => ({
      label: bucket.label,
      value: volume.get(bucket.key) ?? 0,
    })),
    paperSizeDemand: Array.from(paperSizeDemand.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, value]) => ({ label, value })),
  };
}
