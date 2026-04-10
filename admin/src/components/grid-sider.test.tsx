// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { GridSider } from "@/components/grid-sider";

// ── Mocks ──────────────────────────────────────────────────────────
const { mockUseMenu, mockUseNavigation, mockUseNotificationsContext } =
  vi.hoisted(() => ({
    mockUseMenu: vi.fn(),
    mockUseNavigation: vi.fn(),
    mockUseNotificationsContext: vi.fn(),
  }));

vi.mock("@refinedev/core", () => ({
  useMenu: mockUseMenu,
  useNavigation: mockUseNavigation,
}));

vi.mock("@refinedev/antd", () => ({
  ThemedTitleV2: ({ text }: { text: string }) => <div>{text}</div>,
}));

vi.mock("@/context/notifications-context", () => ({
  useNotificationsContext: mockUseNotificationsContext,
}));

vi.mock("@/components/grid-logo", () => ({
  GridLogo: () => <svg data-testid="grid-logo" />,
}));

const menuItems = [
  { key: "/orders", name: "admin/orders", label: "Orders", icon: null, list: "/orders" },
  {
    key: "/credit-requests",
    name: "credit-requests",
    label: "Top-Up Requests",
    icon: null,
    list: "/credit-requests",
  },
  { key: "/drivers", name: "drivers", label: "Drivers", icon: null, list: "/drivers" },
];

function setupMocks(badgeCounts = { newOrders: 3, pendingTopUps: 1 }) {
  mockUseMenu.mockReturnValue({ menuItems, selectedKey: "/orders" });
  mockUseNavigation.mockReturnValue({ push: vi.fn() });
  mockUseNotificationsContext.mockReturnValue({
    badgeCounts,
    notifications: [],
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    refreshBadges: vi.fn(),
  });
}

describe("GridSider", () => {
  beforeEach(() => setupMocks());
  afterEach(() => cleanup());

  it("shows Orders badge when newOrders > 0", () => {
    render(<GridSider />);
    expect(screen.getAllByText("3").length).toBeGreaterThan(0);
  });

  it("does NOT show badge when count is 0", () => {
    setupMocks({ newOrders: 0, pendingTopUps: 0 });
    render(<GridSider />);
    // No badge counts rendered
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("shows Top-Up Requests badge with correct count", () => {
    render(<GridSider />);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("hides badge pills when sidebar is collapsed", () => {
    render(<GridSider initialCollapsed={true} />);
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });
});
