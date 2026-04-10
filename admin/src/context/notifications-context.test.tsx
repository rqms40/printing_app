// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import {
  NotificationsProvider,
  useNotificationsContext,
} from "@/context/notifications-context";
import type { Notification, BadgeCounts } from "@/types/notification";

// ── Mocks ──────────────────────────────────────────────────────────
const { mockGet, mockPatch, mockUnsubscribe } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockUnsubscribe: vi.fn(),
}));

vi.mock("@/providers/api-client", () => ({
  apiClient: { get: mockGet, patch: mockPatch },
}));

let notifCallback: ((n: Notification) => void) | null = null;
vi.mock("@/providers/notification-ws", () => ({
  subscribeToNotifications: vi.fn((cb) => {
    notifCallback = cb;
    return mockUnsubscribe;
  }),
}));

// ── Fixtures ───────────────────────────────────────────────────────
const notif1: Notification = {
  id: 1,
  userId: 10,
  title: "New Order",
  message: "ORD-10042 placed",
  type: "order_placed",
  orderRef: "ORD-10042",
  isRead: false,
  metadata: null,
  createdAt: new Date().toISOString(),
};

const badgeCounts: BadgeCounts = { newOrders: 2, pendingTopUps: 1 };

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <NotificationsProvider>{children}</NotificationsProvider>
);

// ── Tests ──────────────────────────────────────────────────────────
describe("NotificationsContext", () => {
  beforeEach(() => {
    notifCallback = null;
    mockGet.mockReset();
    mockPatch.mockReset();
    mockUnsubscribe.mockReset();

    mockGet.mockImplementation((url: string) => {
      if (url === "/notifications") return Promise.resolve({ data: [notif1] });
      if (url === "/notifications/unread-count") return Promise.resolve({ data: 1 });
      if (url === "/admin/badge-counts") return Promise.resolve({ data: badgeCounts });
      return Promise.resolve({ data: null });
    });
    mockPatch.mockResolvedValue({ data: { ...notif1, isRead: true } });
  });

  it("loads notifications, unreadCount and badgeCounts on mount", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
    });

    expect(result.current.notifications[0].id).toBe(1);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.badgeCounts.newOrders).toBe(2);
  });

  it("prepends new WS notification and increments unreadCount", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    const newNotif: Notification = {
      ...notif1,
      id: 99,
      title: "Another Order",
    };

    act(() => {
      notifCallback!(newNotif);
    });

    expect(result.current.notifications[0].id).toBe(99);
    expect(result.current.unreadCount).toBe(2);
  });

  it("refreshes badgeCounts when a WS notification arrives", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    const updatedBadges: BadgeCounts = { newOrders: 5, pendingTopUps: 3 };
    mockGet.mockImplementation((url: string) => {
      if (url === "/admin/badge-counts")
        return Promise.resolve({ data: updatedBadges });
      return Promise.resolve({ data: [] });
    });

    act(() => {
      notifCallback!(notif1);
    });

    await waitFor(() => {
      expect(result.current.badgeCounts.newOrders).toBe(5);
    });
  });

  it("markRead patches the endpoint and updates local state", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });
    await waitFor(() => expect(result.current.notifications).toHaveLength(1));

    await act(async () => {
      await result.current.markRead(1);
    });

    expect(mockPatch).toHaveBeenCalledWith("/notifications/1/read");
    expect(result.current.notifications[0].isRead).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it("markAllRead patches the endpoint and sets unreadCount to 0", async () => {
    const { result } = renderHook(() => useNotificationsContext(), { wrapper });
    await waitFor(() => expect(result.current.unreadCount).toBe(1));

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(mockPatch).toHaveBeenCalledWith("/notifications/read-all");
    expect(result.current.unreadCount).toBe(0);
  });
});
