import { describe, expect, it, vi } from "vitest";

import { apiClient } from "@/providers/api-client";
import {
  buildAdminUserDetailViewModel,
  buildAdminUsersViewModel,
  loadAdminUserDetail,
  loadAdminUsers,
} from "./data";

vi.mock("@/providers/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("admin users data", () => {
  it("loads only backend users and normalizes the response", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [
        {
          id: 7,
          fullName: "Backend User",
          email: "backend.user@example.com",
          phoneNumber: "+639171234567",
          role: "rider",
          isActive: false,
          isProfileComplete: true,
          profileCategory: "professional",
          profileField: "engineer_contractor",
          course: "Civil Engineering",
          organization: "Grid Build",
          printingPreferences: ["technical_specs"],
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
      ],
    });

    await expect(loadAdminUsers()).resolves.toEqual([
      {
        id: 7,
        full_name: "Backend User",
        email: "backend.user@example.com",
        phone_number: "+639171234567",
        role: "rider",
        is_active: false,
        is_profile_complete: true,
        profile_category: "professional",
        profile_field: "engineer_contractor",
        course: "Civil Engineering",
        organization: "Grid Build",
        printing_preferences: ["technical_specs"],
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ]);
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith("/admin/users");
  });

  it("builds an empty error view with retry when loading fails", () => {
    const view = buildAdminUsersViewModel({
      loading: false,
      users: [],
      error: "Request failed",
    });

    expect(view.kind).toBe("error");
    if (view.kind !== "error") throw new Error("Expected error view");
    expect(view.users).toEqual([]);
    expect(view.retryLabel).toBe("Retry");
    expect(view.message).toContain("Request failed");
  });

  it("loads admin user detail and normalizes the nested response", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        user: {
          id: 7,
          fullName: "Casey Customer",
          email: "casey@example.com",
          phoneNumber: "+639171111111",
          role: "client",
          isActive: true,
          isProfileComplete: true,
          profileCategory: "student",
          profileField: "architecture",
          course: "BS Architecture",
          organization: "North Campus",
          printingPreferences: ["blueprints", "models"],
          gender: "female",
          dateOfBirth: "2001-05-20",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
        metrics: {
          totalOrders: 12,
          paid_orders: 8,
          totalSpend: 15499.5,
          average_order_value: 1291.625,
          lastOrderAt: "2026-04-10T09:30:00.000Z",
          last_paid_order_at: "2026-04-08T15:00:00.000Z",
        },
        recent_orders: [
          {
            id: 91,
            orderId: "ORD-91",
            category: "paper",
            orderStatus: "completed_pickup",
            payment_status: "paid",
            totalPrice: 3200,
            createdAt: "2026-04-10T09:30:00.000Z",
          },
          {
            id: 92,
            order_id: "ORD-92",
            category: "3d",
            order_status: "delivered",
            paymentStatus: "pending",
            total_price: 4500,
            created_at: "2026-04-12T11:00:00.000Z",
          },
        ],
      },
    });

    await expect(loadAdminUserDetail(7)).resolves.toEqual({
      user: {
        id: 7,
        full_name: "Casey Customer",
        email: "casey@example.com",
        phone_number: "+639171111111",
        role: "client",
        is_active: true,
        is_profile_complete: true,
        profile_category: "student",
        profile_field: "architecture",
        course: "BS Architecture",
        organization: "North Campus",
        printing_preferences: ["blueprints", "models"],
        gender: "female",
        date_of_birth: "2001-05-20",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
      metrics: {
        total_orders: 12,
        paid_orders: 8,
        total_spend: 15499.5,
        average_order_value: 1291.625,
        last_order_at: "2026-04-10T09:30:00.000Z",
        last_paid_order_at: "2026-04-08T15:00:00.000Z",
      },
      recent_orders: [
        {
          id: 91,
          order_id: "ORD-91",
          category: "paper",
          order_status: "completed_pickup",
          payment_status: "paid",
          total_price: 3200,
          created_at: "2026-04-10T09:30:00.000Z",
        },
        {
          id: 92,
          order_id: "ORD-92",
          category: "3d",
          order_status: "delivered",
          payment_status: "pending",
          total_price: 4500,
          created_at: "2026-04-12T11:00:00.000Z",
        },
      ],
    });
    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith("/admin/users/7");
  });

  it("builds a retryable error state for user detail failures", () => {
    expect(
      buildAdminUserDetailViewModel({
        loading: false,
        detail: null,
        error: "Unable to load user",
      }),
    ).toEqual({
      kind: "error",
      title: "User",
      message: "Unable to load user",
      retryLabel: "Retry",
    });
  });

  it("returns null detail when nested metrics are malformed", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        user: {
          id: 7,
          fullName: "Casey Customer",
          email: "casey@example.com",
          role: "client",
          isActive: true,
          isProfileComplete: true,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
        metrics: {
          totalOrders: "twelve",
          paid_orders: 8,
          totalSpend: 15499.5,
          average_order_value: 1291.625,
          lastOrderAt: "2026-04-10T09:30:00.000Z",
          last_paid_order_at: "2026-04-08T15:00:00.000Z",
        },
        recent_orders: [],
      },
    });

    await expect(loadAdminUserDetail(7)).resolves.toBeNull();
  });

  it("returns null detail when recent order entries are malformed", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        user: {
          id: 7,
          fullName: "Casey Customer",
          email: "casey@example.com",
          role: "client",
          isActive: true,
          isProfileComplete: true,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
        metrics: {
          totalOrders: 12,
          paid_orders: 8,
          totalSpend: 15499.5,
          average_order_value: 1291.625,
          lastOrderAt: "2026-04-10T09:30:00.000Z",
          last_paid_order_at: "2026-04-08T15:00:00.000Z",
        },
        recent_orders: [
          {
            id: null,
            orderId: "",
            category: "paper",
            orderStatus: "completed_pickup",
            payment_status: "paid",
            totalPrice: 3200,
            createdAt: "2026-04-10T09:30:00.000Z",
          },
        ],
      },
    });

    await expect(loadAdminUserDetail(7)).resolves.toBeNull();
  });

  it("returns null detail when recent order enum-like fields are invalid", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        user: {
          id: 7,
          fullName: "Casey Customer",
          email: "casey@example.com",
          role: "client",
          isActive: true,
          isProfileComplete: true,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-15T00:00:00.000Z",
        },
        metrics: {
          totalOrders: 12,
          paid_orders: 8,
          totalSpend: 15499.5,
          average_order_value: 1291.625,
          lastOrderAt: "2026-04-10T09:30:00.000Z",
          last_paid_order_at: "2026-04-08T15:00:00.000Z",
        },
        recent_orders: [
          {
            id: 91,
            orderId: "ORD-91",
            category: "poster",
            orderStatus: "shipped",
            payment_status: "processing",
            totalPrice: 3200,
            createdAt: "2026-04-10T09:30:00.000Z",
          },
        ],
      },
    });

    await expect(loadAdminUserDetail(7)).resolves.toBeNull();
  });

  it("builds a ready view from backend users without any fallback rows", () => {
    const view = buildAdminUsersViewModel({
      loading: false,
      users: [
        {
          id: 1,
          full_name: "Backend Only",
          email: "backend.only@example.com",
          phone_number: null,
          role: "client",
          is_active: true,
          is_profile_complete: false,
          profile_category: null,
          profile_field: null,
          course: null,
          organization: null,
          printing_preferences: [],
          created_at: "2026-03-10T00:00:00.000Z",
          updated_at: "2026-03-10T00:00:00.000Z",
        },
      ],
      error: null,
    });

    expect(view.kind).toBe("ready");
    expect(view.users).toHaveLength(1);
    expect(view.users[0]?.full_name).toBe("Backend Only");
  });
});
