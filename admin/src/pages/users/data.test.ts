import { describe, expect, it, vi } from "vitest";

import { apiClient } from "@/providers/api-client";
import {
  buildAdminUsersViewModel,
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
          role: "driver",
          isActive: false,
          isProfileComplete: true,
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
        role: "driver",
        is_active: false,
        is_profile_complete: true,
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

  it("builds a ready view from backend users without any fallback rows", () => {
    const view = buildAdminUsersViewModel({
      loading: false,
      users: [
        {
          id: 1,
          full_name: "Backend Only",
          email: "backend.only@example.com",
          phone_number: null,
          role: "customer",
          is_active: true,
          is_profile_complete: false,
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
