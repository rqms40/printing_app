// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { NotificationBell } from "@/components/notification-bell";
import type { Notification } from "@/types/notification";

// ── Mocks ──────────────────────────────────────────────────────────
const { mockMarkRead, mockMarkAllRead, mockNavigate, mockUseNotificationsContext } =
  vi.hoisted(() => ({
    mockMarkRead: vi.fn(),
    mockMarkAllRead: vi.fn(),
    mockNavigate: vi.fn(),
    mockUseNotificationsContext: vi.fn(),
  }));

vi.mock("@/context/notifications-context", () => ({
  useNotificationsContext: mockUseNotificationsContext,
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const makeNotif = (overrides: Partial<Notification> = {}): Notification => ({
  id: 1,
  userId: 10,
  title: "New Order Placed",
  message: "ORD-10042 received",
  type: "order_placed",
  orderRef: "ORD-10042",
  isRead: false,
  metadata: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

function setupContext(overrides: object = {}) {
  mockUseNotificationsContext.mockReturnValue({
    notifications: [makeNotif()],
    unreadCount: 1,
    badgeCounts: { newOrders: 0, pendingTopUps: 0 },
    markRead: mockMarkRead,
    markAllRead: mockMarkAllRead,
    refreshBadges: vi.fn(),
    ...overrides,
  });
}

describe("NotificationBell", () => {
  beforeEach(() => {
    mockMarkRead.mockReset();
    mockMarkAllRead.mockReset();
    mockNavigate.mockReset();
    setupContext();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows unreadCount as badge on the bell", () => {
    render(<NotificationBell />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows dot overflow when unreadCount > 99", () => {
    setupContext({ unreadCount: 100 });
    render(<NotificationBell />);
    // Ant Design renders overflow as "99+" when overflowCount=99
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("shows empty state when no notifications", async () => {
    setupContext({ notifications: [], unreadCount: 0 });
    render(<NotificationBell />);
    const bell = screen.getAllByTestId("notification-bell")[0];
    fireEvent.click(bell);
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument();
  });

  it("calls markRead when a notification row is clicked", async () => {
    render(<NotificationBell />);
    const bell = screen.getAllByTestId("notification-bell")[0];
    fireEvent.click(bell);

    const notifRow = await screen.findByText("New Order Placed");
    fireEvent.click(notifRow);

    expect(mockMarkRead).toHaveBeenCalledWith(1);
  });

  it("calls markAllRead when Mark all is clicked", async () => {
    render(<NotificationBell />);
    const bell = screen.getAllByTestId("notification-bell")[0];
    fireEvent.click(bell);

    const markAll = await screen.findByText(/mark all/i);
    fireEvent.click(markAll);

    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  it("navigates to /notifications when View all is clicked", async () => {
    render(<NotificationBell />);
    const bell = screen.getAllByTestId("notification-bell")[0];
    fireEvent.click(bell);

    const viewAll = await screen.findByText(/view all/i);
    fireEvent.click(viewAll);

    expect(mockNavigate).toHaveBeenCalledWith("/notifications");
  });
});
