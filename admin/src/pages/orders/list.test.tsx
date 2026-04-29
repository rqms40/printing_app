// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { OrderList } from "./list";

const { mockGet, mockSubscribeToOrderUpdates } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSubscribeToOrderUpdates: vi.fn(() => vi.fn()),
}));

vi.mock("@refinedev/antd", () => ({
  List: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h1>{title}</h1>
      {children}
    </section>
  ),
}));

vi.mock("@/providers/api-client", () => ({
  apiClient: {
    get: mockGet,
    patch: vi.fn(),
  },
}));

vi.mock("@/providers/live-provider", () => ({
  subscribeToOrderUpdates: mockSubscribeToOrderUpdates,
}));

vi.mock("antd", async () => {
  const actual = await vi.importActual<typeof import("antd")>("antd");

  return {
    ...actual,
    App: {
      useApp: () => ({
        modal: { confirm: vi.fn() },
        message: { success: vi.fn(), error: vi.fn() },
      }),
    },
  };
});

describe("OrderList", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows an error state without fabricated orders when loading fails", async () => {
    mockGet.mockRejectedValue(new Error("Request failed"));

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <OrderList />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Request failed")).toBeInTheDocument();
    expect(screen.queryByText("ORD-00147")).not.toBeInTheDocument();
    expect(screen.queryByText("thesis_final.pdf")).not.toBeInTheDocument();
  });
});
