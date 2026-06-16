// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { UsersTab } from "./users-tab";

const { mockLoadAdminUsersAnalytics } = vi.hoisted(() => ({
  mockLoadAdminUsersAnalytics: vi.fn(),
}));

vi.mock("./users-analytics", async () => {
  const actual = await vi.importActual<typeof import("./users-analytics")>("./users-analytics");

  return {
    ...actual,
    loadAdminUsersAnalytics: mockLoadAdminUsersAnalytics,
  };
});

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <svg role="img" aria-label="chart">
      {children}
    </svg>
  ),
  AreaChart: ({ children }: { children: ReactNode }) => <g>{children}</g>,
  BarChart: ({ children }: { children: ReactNode }) => <g>{children}</g>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Area: () => null,
  Bar: ({ children }: { children: ReactNode }) => <g>{children}</g>,
  Cell: () => null,
}));

describe("UsersTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders user KPIs from a successful analytics load", async () => {
    mockLoadAdminUsersAnalytics.mockResolvedValue({
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
      profile_category_mix: [
        { label: "Student", value: 70 },
      ],
      profile_field_mix: [
        { label: "Architecture", value: 22 },
      ],
      top_segments: [],
      preference_mix: [
        { label: "Blueprints", value: 30 },
      ],
      activity_split: [
        { label: "Active", value: 52 },
      ],
      revenue_by_segment: [],
    });

    render(<UsersTab />);

    expect(await screen.findByText("124")).toBeInTheDocument();
    expect(screen.getByText("Total Customers")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
    expect(screen.getByText("New Customers")).toBeInTheDocument();
    expect(screen.getByText("Active Customers")).toBeInTheDocument();
    expect(screen.getByText("84.5%")).toBeInTheDocument();
    expect(screen.getByText("Profile Completion Rate")).toBeInTheDocument();
    expect(screen.getByText("Role Distribution")).toBeInTheDocument();
    expect(screen.getByText("Signup Trend")).toBeInTheDocument();
    expect(mockLoadAdminUsersAnalytics).toHaveBeenCalledWith("7D");
  });

  it("shows a retryable error state when analytics are missing or loading fails", async () => {
    mockLoadAdminUsersAnalytics
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        summary: {
          total_customers: 50,
          new_customers: 4,
          active_customers: 20,
          profile_completion_rate: 72,
          role_counts: {
            customers: 45,
            riders: 3,
            admins: 2,
          },
        },
        signup_trend: [],
        profile_category_mix: [],
        profile_field_mix: [],
        top_segments: [],
        preference_mix: [],
        activity_split: [],
        revenue_by_segment: [],
      });

    const user = userEvent.setup();

    render(<UsersTab />);

    expect(await screen.findByText("Unable to load users analytics")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("network down")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("50")).toBeInTheDocument();
    expect(mockLoadAdminUsersAnalytics).toHaveBeenCalledTimes(3);
  });

  it("reloads analytics for each local period selection", async () => {
    mockLoadAdminUsersAnalytics.mockResolvedValue({
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
      signup_trend: [],
      profile_category_mix: [],
      profile_field_mix: [],
      top_segments: [],
      preference_mix: [],
      activity_split: [],
      revenue_by_segment: [],
    });

    const user = userEvent.setup();

    render(<UsersTab />);

    await screen.findByText("124");

    await user.click(screen.getByText("30D"));
    await waitFor(() => {
      expect(mockLoadAdminUsersAnalytics).toHaveBeenLastCalledWith("30D");
    });

    await user.click(screen.getByText("6M"));
    await waitFor(() => {
      expect(mockLoadAdminUsersAnalytics).toHaveBeenLastCalledWith("6M");
    });

    expect(mockLoadAdminUsersAnalytics).toHaveBeenNthCalledWith(1, "7D");
  });
});
