// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { GridSider } from "@/components/grid-sider";

// ── Mocks ──────────────────────────────────────────────────────────
const {
  mockUseMenu,
  mockUseNavigation,
  mockUseNotificationsContext,
  mockUseGetIdentity,
} = vi.hoisted(() => ({
  mockUseMenu: vi.fn(),
  mockUseNavigation: vi.fn(),
  mockUseNotificationsContext: vi.fn(),
  mockUseGetIdentity: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useMenu: mockUseMenu,
  useNavigation: mockUseNavigation,
  useGetIdentity: mockUseGetIdentity,
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
    label: "Pilot Credits",
    icon: null,
    list: "/credit-requests",
  },
  { key: "/riders", name: "riders", label: "Riders", icon: null, list: "/riders" },
];

function setupMocks(
  badgeCounts = { newOrders: 3, pendingTopUps: 1 },
  role: string = "ops_admin",
) {
  mockUseMenu.mockReturnValue({ menuItems, selectedKey: "/orders" });
  mockUseNavigation.mockReturnValue({ push: vi.fn() });
  mockUseGetIdentity.mockReturnValue({
    data: { id: "1", name: "Admin", email: "admin@gridgo.ph", role },
    isLoading: false,
  });
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

  it("shows Pilot Credits badge with correct count", () => {
    render(<GridSider />);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("hides badge pills when sidebar is collapsed", () => {
    render(<GridSider initialCollapsed={true} />);
    expect(screen.queryByText("3")).not.toBeInTheDocument();
    expect(screen.queryByText("1")).not.toBeInTheDocument();
  });

  it("hides ops menu while identity is loading (default-deny)", () => {
    mockUseGetIdentity.mockReturnValue({
      data: undefined,
      isLoading: true,
    });
    render(<GridSider />);
    expect(screen.queryByText("Orders")).not.toBeInTheDocument();
    expect(screen.queryByText("Riders")).not.toBeInTheDocument();
    expect(screen.getByText("GRIDGO")).toBeInTheDocument();
  });

  it("shows only supplier brand path after supplier identity loads", () => {
    const supplierMenu = [
      ...menuItems,
      {
        key: "/supplier/jobs",
        name: "supplier-jobs",
        label: "Jobs",
        icon: null,
        list: "/supplier/jobs",
      },
    ];
    mockUseMenu.mockReturnValue({
      menuItems: supplierMenu,
      selectedKey: "/supplier/jobs",
    });
    mockUseGetIdentity.mockReturnValue({
      data: {
        id: "9",
        name: "Shop",
        email: "shop@gridgo.ph",
        role: "supplier",
      },
      isLoading: false,
    });
    render(<GridSider />);
    expect(screen.getByText("Jobs")).toBeInTheDocument();
    expect(screen.queryByText("Orders")).not.toBeInTheDocument();
    expect(screen.getByText("GRIDGO Supplier")).toBeInTheDocument();
  });
});
