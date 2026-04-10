import { describe, expect, it } from "vitest";

import type { Order } from "@/types/order";

import {
  deriveDashboardAnalyticsFromOrders,
  hasModernDashboardAnalyticsPayload,
  normalizeDashboardAnalytics,
} from "./analytics-contract";

describe("normalizeDashboardAnalytics", () => {
  it("maps the backend analytics payload into chart-safe series arrays", () => {
    const analytics = normalizeDashboardAnalytics({
      tatTrend: [
        { label: "Mar 31", value: 100 },
        { label: "Mar 30", value: 80 },
      ],
      volume: [
        { label: "Mar 31", value: 2 },
      ],
      paperSizeDemand: [
        { label: "A4", value: 3 },
        { label: "A3", value: 1 },
      ],
    });

    expect(analytics.tatTrend).toEqual([
      { label: "Mar 31", value: 100 },
      { label: "Mar 30", value: 80 },
    ]);
    expect(analytics.volume).toEqual([{ label: "Mar 31", value: 2 }]);
    expect(analytics.paperSizeDemand).toEqual([
      { label: "A4", value: 3 },
      { label: "A3", value: 1 },
    ]);
  });

  it("drops malformed analytics entries instead of leaking fake chart data", () => {
    const analytics = normalizeDashboardAnalytics({
      tatTrend: [{ label: "Mar 31", value: "100" }, { bad: true }],
      volume: null,
      paperSizeDemand: [{ label: "A4", value: 2 }],
    });

    expect(analytics.tatTrend).toEqual([]);
    expect(analytics.volume).toEqual([]);
    expect(analytics.paperSizeDemand).toEqual([{ label: "A4", value: 2 }]);
  });

  it("detects the stale legacy analytics payload shape served by the old backend", () => {
    expect(
      hasModernDashboardAnalyticsPayload({
        tatTrend: [{ month: "Oct", value: 45200 }],
        volume: [{ month: "Oct", value: 38 }],
      }),
    ).toBe(false);

    expect(
      hasModernDashboardAnalyticsPayload({
        tatTrend: [{ label: "Mar 31", value: 100 }],
        volume: [{ label: "Mar 31", value: 2 }],
        paperSizeDemand: [],
      }),
    ).toBe(true);
  });

  it("derives chart data from real orders when the analytics endpoint is stale", () => {
    const orders: Order[] = [
      {
        id: "1",
        order_id: "ORD-1",
        user_id: "1",
        category: "paper",
        quantity: 1,
        total_price: 100,
        delivery_fee: 0,
        payment_method: "gcash",
        payment_status: "paid",
        order_status: "delivered",
        delivery_option: "pickup",
        created_at: "2026-03-31T09:00:00.000Z",
        updated_at: "2026-03-31T09:00:00.000Z",
        paper_specs: {
          paper_size: "a4",
          color_mode: "full_color",
          media_type: "matte",
          print_sides: "front_only",
          binding: "none",
        },
      },
      {
        id: "2",
        order_id: "ORD-2",
        user_id: "1",
        category: "paper",
        quantity: 1,
        total_price: 80,
        delivery_fee: 0,
        payment_method: "cod",
        payment_status: "pending",
        order_status: "printing_in_progress",
        delivery_option: "pickup",
        created_at: "2026-03-30T09:00:00.000Z",
        updated_at: "2026-03-30T09:00:00.000Z",
        paper_specs: {
          paper_size: "a3",
          color_mode: "full_color",
          media_type: "matte",
          print_sides: "front_only",
          binding: "none",
        },
      },
      {
        id: "3",
        order_id: "ORD-3",
        user_id: "1",
        category: "3d",
        quantity: 1,
        total_price: 200,
        delivery_fee: 0,
        payment_method: "maya",
        payment_status: "paid",
        order_status: "delivered",
        delivery_option: "delivery",
        created_at: "2026-03-29T09:00:00.000Z",
        updated_at: "2026-03-29T09:00:00.000Z",
      },
    ];

    const analytics = deriveDashboardAnalyticsFromOrders(
      orders,
      "30D",
      new Date("2026-03-31T12:00:00.000Z"),
    );

    expect(analytics.tatTrend).toEqual(
      expect.arrayContaining([
        { label: "Mar 31", value: 0 },
        { label: "Mar 30", value: 0 },
        { label: "Mar 29", value: 0 },
      ]),
    );
    expect(analytics.volume).toEqual(
      expect.arrayContaining([
        { label: "Mar 31", value: 1 },
        { label: "Mar 30", value: 1 },
        { label: "Mar 29", value: 1 },
      ]),
    );
    expect(analytics.paperSizeDemand).toEqual([
      { label: "A3", value: 1 },
      { label: "A4", value: 1 },
    ]);
  });
});
