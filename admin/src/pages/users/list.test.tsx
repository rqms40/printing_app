// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { UserList } from "./list";

const { mockLoadAdminUsers } = vi.hoisted(() => ({
  mockLoadAdminUsers: vi.fn(),
}));

vi.mock("@refinedev/antd", () => ({
  List: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

vi.mock("./data", async () => {
  const actual = await vi.importActual<typeof import("./data")>("./data");

  return {
    ...actual,
    loadAdminUsers: mockLoadAdminUsers,
  };
});

describe("UserList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders a View action that links to the user show page", async () => {
    mockLoadAdminUsers.mockResolvedValue([
      {
        id: 7,
        full_name: "Casey Customer",
        email: "casey@example.com",
        phone_number: "+639171111111",
        role: "customer",
        is_active: true,
        is_profile_complete: false,
        profile_category: "student",
        profile_field: "architecture",
        course: null,
        organization: null,
        printing_preferences: [],
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-15T00:00:00.000Z",
      },
    ]);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UserList />
      </MemoryRouter>,
    );

    const viewLink = await screen.findByRole("link", { name: "View" });

    await waitFor(() => {
      expect(viewLink).toHaveAttribute("href", "/users/show/7");
    });
  });

  it("shows an error state without fabricated users when loading fails", async () => {
    mockLoadAdminUsers.mockRejectedValue(new Error("Request failed"));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <UserList />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Request failed")).toBeInTheDocument();
    expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View" })).not.toBeInTheDocument();
  });
});
