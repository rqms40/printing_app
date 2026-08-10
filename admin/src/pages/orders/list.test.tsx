// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";

import { OrderList } from "./list";

const { mockGet, mockPatch, mockSubscribeToOrderUpdates } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
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
    patch: mockPatch,
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

  it(
    "renders only the server-provided order status actions",
    async () => {
      mockGet.mockResolvedValue({
        data: [{
          id: 42,
          order_id: "ORD-MARK",
          user_id: 1,
          customer_name: "Mark",
          category: "paper",
          quantity: 1,
          total_price: 20,
          delivery_fee: 0,
          payment_method: "grid_credits",
          payment_status: "paid",
          order_status: "submitted",
          allowed_next_statuses: ["approved_for_matching", "file_rejected"],
          delivery_option: "delivery",
          created_at: "2026-07-10T10:00:00.000Z",
          updated_at: "2026-07-10T10:00:00.000Z",
        }],
      });

      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <OrderList />
        </MemoryRouter>,
      );

      await screen.findByText("ORD-MARK", {}, { timeout: 15_000 });
      const action = await screen.findByRole("combobox", {
        name: "Update status for ORD-MARK",
      });
      fireEvent.mouseDown(action);

      expect(
        await screen.findByText("Approved for Matching"),
      ).toBeInTheDocument();
      expect(screen.getByText("File Rejected")).toBeInTheDocument();
      expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
      expect(screen.queryByText("Rider Assigned")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "View details for ORD-MARK" }),
      ).toBeInTheDocument();
    },
    30_000,
  );

  it(
    "requires a trimmed reason before submitting a server-provided file decline",
    async () => {
      const order = {
        id: 42,
        order_id: "ORD-MARK",
        user_id: 1,
        customer_name: "Mark",
        category: "paper",
        quantity: 1,
        total_price: 20,
        delivery_fee: 0,
        payment_method: "grid_credits",
        payment_status: "paid",
        order_status: "submitted",
        allowed_next_statuses: ["approved_for_matching", "file_rejected"],
        delivery_option: "delivery",
        created_at: "2026-07-10T10:00:00.000Z",
        updated_at: "2026-07-10T10:00:00.000Z",
      };
      mockPatch.mockResolvedValue({ data: {} });
      mockGet.mockImplementation((url: string) =>
        Promise.resolve({
          data:
            url === "/admin/orders"
              ? [order]
              : {
                  ...order,
                  order_status: "file_rejected",
                  allowed_next_statuses: [],
                },
        }),
      );

      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <OrderList />
        </MemoryRouter>,
      );

      await screen.findByText("ORD-MARK", {}, { timeout: 15_000 });
      fireEvent.mouseDown(
        await screen.findByRole("combobox", {
          name: "Update status for ORD-MARK",
        }),
      );
      fireEvent.click(await screen.findByText("File Rejected"));

      const submit = await screen.findByRole("button", { name: "Decline file" });
      const reason = screen.getByLabelText("File decline reason");
      expect(submit).toBeDisabled();
      fireEvent.change(reason, { target: { value: "   " } });
      expect(submit).toBeDisabled();
      fireEvent.change(reason, { target: { value: "  Corrupted PDF  " } });
      expect(submit).toBeEnabled();
      fireEvent.click(submit);

      await waitFor(() => {
        expect(mockPatch).toHaveBeenCalledWith("/admin/orders/42/status", {
          status: "file_rejected",
          notes: "Corrupted PDF",
        });
        expect(mockGet).toHaveBeenCalledWith("/admin/orders/42");
      });
    },
    30_000,
  );
});
