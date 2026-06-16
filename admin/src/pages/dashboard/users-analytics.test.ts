import { describe, expect, it, vi } from "vitest";

import { apiClient } from "@/providers/api-client";

import {
  buildUsersAnalyticsViewModel,
  loadAdminUsersAnalytics,
  normalizeAdminUsersAnalytics,
} from "./users-analytics";

vi.mock("@/providers/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("users analytics data", () => {
  it("loads /admin/users/analytics for the requested period and normalizes the response", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        summary: {
          total_customers: 124,
          new_customers: 18,
          active_customers: 52,
          profile_completion_rate: 84.5,
          role_counts: {
            customers: 110,
            riders: 10,
            admins: 4,
          },
        },
        signup_trend: [
          { label: "Apr 11", value: 2 },
          { label: "Apr 12", value: 3 },
        ],
        profile_category_mix: [
          { label: "Student", value: 70 },
        ],
        profile_field_mix: [
          { label: "Architecture", value: 22 },
        ],
        top_segments: [
          { label: "Campus A", value: 14 },
        ],
        preference_mix: [
          { label: "Blueprints", value: 30 },
        ],
        activity_split: [
          { label: "Active", value: 52 },
          { label: "Inactive", value: 72 },
        ],
        revenue_by_segment: [
          { label: "Professional", value: 14500 },
        ],
      },
    });

    await expect(loadAdminUsersAnalytics("30D")).resolves.toEqual({
      summary: {
        total_customers: 124,
        new_customers: 18,
        active_customers: 52,
        profile_completion_rate: 84.5,
        role_counts: {
          customers: 110,
          riders: 10,
          admins: 4,
        },
      },
      signup_trend: [
        { label: "Apr 11", value: 2 },
        { label: "Apr 12", value: 3 },
      ],
      profile_category_mix: [
        { label: "Student", value: 70 },
      ],
      profile_field_mix: [
        { label: "Architecture", value: 22 },
      ],
      top_segments: [
        { label: "Campus A", value: 14 },
      ],
      preference_mix: [
        { label: "Blueprints", value: 30 },
      ],
      activity_split: [
        { label: "Active", value: 52 },
        { label: "Inactive", value: 72 },
      ],
      revenue_by_segment: [
        { label: "Professional", value: 14500 },
      ],
    });
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith("/admin/users/analytics?period=30D");
  });

  it("returns null for malformed top-level payloads instead of normalizing them into ready analytics", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        signup_trend: [],
      },
    });

    expect(normalizeAdminUsersAnalytics(null)).toBeNull();
    expect(normalizeAdminUsersAnalytics({ signup_trend: [] })).toBeNull();
    await expect(loadAdminUsersAnalytics("7D")).resolves.toBeNull();

    expect(
      buildUsersAnalyticsViewModel({
        loading: false,
        analytics: normalizeAdminUsersAnalytics({ signup_trend: [] }),
        error: null,
      }),
    ).toEqual({
      kind: "error",
      message: "Unable to load users analytics",
      retryLabel: "Retry",
    });
  });

  it("drops malformed series rows and defaults only absent summary numbers to 0", () => {
    expect(
      normalizeAdminUsersAnalytics({
        summary: {
          active_customers: 9,
          profile_completion_rate: 45,
          role_counts: {
            customers: 7,
          },
        },
        signup_trend: [
          { label: "Apr 11", value: 2 },
          { label: 7, value: 3 },
          { label: "Apr 13", value: "4" },
          null,
        ],
        profile_category_mix: [],
        profile_field_mix: [
          { label: "Architecture", value: 2 },
          { bad: true },
        ],
        top_segments: [],
        preference_mix: [
          { label: "Blueprints", value: 5 },
        ],
        activity_split: [
          { label: "Active", value: 9 },
          {},
        ],
        revenue_by_segment: [
          { label: "Student", value: 2500 },
          { label: "Professional" },
        ],
      }),
    ).toEqual({
      summary: {
        total_customers: 0,
        new_customers: 0,
        active_customers: 9,
        profile_completion_rate: 45,
        role_counts: {
          customers: 7,
          riders: 0,
          admins: 0,
        },
      },
      signup_trend: [{ label: "Apr 11", value: 2 }],
      profile_category_mix: [],
      profile_field_mix: [{ label: "Architecture", value: 2 }],
      top_segments: [],
      preference_mix: [{ label: "Blueprints", value: 5 }],
      activity_split: [{ label: "Active", value: 9 }],
      revenue_by_segment: [{ label: "Student", value: 2500 }],
    });
  });

  it("returns null when invalid numeric values violate analytics semantics", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        summary: {
          total_customers: -1,
          new_customers: 18,
          active_customers: 52,
          profile_completion_rate: 101,
          role_counts: {
            customers: 110,
            riders: 10,
            admins: 4,
          },
        },
        signup_trend: [
          { label: "Apr 11", value: -2 },
        ],
        profile_category_mix: [],
        profile_field_mix: [],
        top_segments: [],
        preference_mix: [],
        activity_split: [],
        revenue_by_segment: [],
      },
    });

    expect(
      normalizeAdminUsersAnalytics({
        summary: {
          total_customers: -1,
          new_customers: 18,
          active_customers: 52,
          profile_completion_rate: 101,
          role_counts: {
            customers: 110,
            riders: 10,
            admins: 4,
          },
        },
        signup_trend: [
          { label: "Apr 11", value: -2 },
        ],
        profile_category_mix: [],
        profile_field_mix: [],
        top_segments: [],
        preference_mix: [],
        activity_split: [],
        revenue_by_segment: [],
      }),
    ).toBeNull();

    await expect(loadAdminUsersAnalytics("30D")).resolves.toBeNull();

    expect(
      buildUsersAnalyticsViewModel({
        loading: false,
        analytics: null,
        error: null,
      }),
    ).toEqual({
      kind: "error",
      message: "Unable to load users analytics",
      retryLabel: "Retry",
    });
  });

  it("builds the loading branch while analytics are pending", () => {
    expect(
      buildUsersAnalyticsViewModel({
        loading: true,
        analytics: null,
        error: null,
      }),
    ).toEqual({
      kind: "loading",
    });
  });

  it("builds the ready branch when normalized analytics are present", () => {
    const analytics = normalizeAdminUsersAnalytics({
      summary: {
        total_customers: 124,
        new_customers: 18,
        active_customers: 52,
        profile_completion_rate: 84.5,
        role_counts: {
          customers: 110,
          riders: 10,
          admins: 4,
        },
      },
      signup_trend: [
        { label: "Apr 11", value: 2 },
      ],
      profile_category_mix: [],
      profile_field_mix: [],
      top_segments: [],
      preference_mix: [],
      activity_split: [],
      revenue_by_segment: [],
    });

    expect(analytics).not.toBeNull();
    expect(
      buildUsersAnalyticsViewModel({
        loading: false,
        analytics,
        error: null,
      }),
    ).toEqual({
      kind: "ready",
      analytics,
    });
  });

  it("returns a retryable error view when analytics are missing or the request state has an error", () => {
    expect(
      buildUsersAnalyticsViewModel({
        loading: false,
        analytics: null,
        error: "Request failed",
      }),
    ).toEqual({
      kind: "error",
      message: "Request failed",
      retryLabel: "Retry",
    });

    expect(
      buildUsersAnalyticsViewModel({
        loading: false,
        analytics: null,
        error: null,
      }),
    ).toEqual({
      kind: "error",
      message: "Unable to load users analytics",
      retryLabel: "Retry",
    });
  });
});
