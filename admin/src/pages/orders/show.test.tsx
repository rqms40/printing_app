// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OrderShow } from "./show";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("@/providers/api-client", () => ({
  apiClient: { get: mockGet, patch: vi.fn(), post: vi.fn() },
}));
vi.mock("react-router", () => ({ useParams: () => ({ id: "42" }) }));
vi.mock("react-router-dom", () => ({
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn() }),
}));
vi.mock("leaflet", () => ({
  DivIcon: class {},
  LatLngBounds: class {},
}));
vi.mock("@/components/show-page", () => ({
  ShowPage: ({ title, children }: { title: string; children: ReactNode }) => (
    <section><h1>{title}</h1>{children}</section>
  ),
}));
vi.mock("@/components/file-preview-modal", () => ({ FilePreviewModal: () => null }));
vi.mock("@/components/file-inspector/file-inspector-modal", () => ({ FileInspectorModal: () => null }));
vi.mock("./components/manual-status-card", () => ({ ManualStatusCard: () => null }));

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

const baseOrder = {
  id: 42,
  order_id: "ORD-MARK",
  user_id: 1,
  customer_name: "Mark",
  customer_email: "mark@example.test",
  category: "paper",
  quantity: 1,
  total_price: 20,
  delivery_fee: 0,
  payment_method: "grid_credits",
  payment_status: "paid",
  order_status: "submitted",
  allowed_next_statuses: ["approved_for_matching", "file_rejected"],
  delivery_option: "delivery",
  delivery_proof: {
    type: "signature",
    signature_data: "data:image/png;base64,PRIVATE-SIGNATURE",
    captured_at: "2026-07-10T10:30:00.000Z",
    captured_by_rider_id: 10,
  },
  status_history: [{
    id: 1,
    order_id: 42,
    from_status: "submitted",
    to_status: "file_rejected",
    changed_by_user_id: 31,
    notes: "Customer file is corrupted",
    created_at: "2026-07-10T10:15:00.000Z",
  }],
  items: [],
  created_at: "2026-07-10T10:00:00.000Z",
  updated_at: "2026-07-10T10:30:00.000Z",
};

const riders = [
  { id: 10, full_name: "Juan", vehicle_type: "motorcycle", is_available: true, assignment_eligible: false },
  { id: 11, full_name: "Maria", vehicle_type: "motorcycle", is_available: true, assignment_eligible: true },
];

describe("OrderShow", () => {
  beforeEach(() => {
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({ data: url === "/admin/riders" ? riders : baseOrder }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("uses server status actions and renders actor-aware history without raw signatures", async () => {
    render(<OrderShow />);

    const action = await screen.findByRole("combobox", {
      name: "Update status for ORD-MARK",
    });
    fireEvent.mouseDown(action);

    expect((await screen.findAllByText("Approved for Matching")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Cancelled")).not.toBeInTheDocument();
    expect(screen.getByText(/Actor #31/)).toBeInTheDocument();
    expect(screen.getByText(/Customer file is corrupted/)).toBeInTheDocument();
    expect(screen.getByText("Signature captured")).toBeInTheDocument();
    expect(screen.queryByText(/PRIVATE-SIGNATURE/)).not.toBeInTheDocument();
  });

  it("renders dynamic RFQ leaf/spec snapshots and never shows a pending zero price", async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve({
      data: url === "/admin/riders" ? riders : {
        ...baseOrder,
        category: "flyers",
        pricing_status: "pending_quote",
        total_price: null,
        delivery_fee: null,
        unmet_coverage: true,
        items: [{
          id: 8, category: "flyers", category_name: "Flyers",
          group_name: "Marketing & Promotional Collateral", quantity: 100,
          total_price: null,
          specs: [{ key: "finish", label: "UV-DTF / CMYK+W", value: "matte", display_value: "Soft-touch matte" }],
        }],
      },
    }));
    render(<OrderShow />);
    expect((await screen.findAllByText("Flyers")).length).toBeGreaterThan(0);
    expect(screen.getByText("Marketing & Promotional Collateral")).toBeInTheDocument();
    expect(screen.getByText("UV-DTF / CMYK+W")).toBeInTheDocument();
    expect(screen.getByText("Soft-touch matte")).toBeInTheDocument();
    expect(screen.getAllByText("Price pending quote").length).toBeGreaterThan(0);
    expect(screen.getByText("Unmet supplier coverage")).toBeInTheDocument();
    expect(screen.queryByText(/₱0\.00/)).not.toBeInTheDocument();
  });

  it("shows only server-eligible riders in the assignment dialog", async () => {
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === "/admin/riders"
            ? riders
            : { ...baseOrder, order_status: "ready_for_dispatch", allowed_next_statuses: [] },
      }),
    );

    render(<OrderShow />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Assign rider for ORD-MARK" }),
    );

    expect(await screen.findByText("Maria")).toBeInTheDocument();
    expect(screen.queryByText("Juan")).not.toBeInTheDocument();
  });

  it("keeps the assigned rider identity visible on the order", async () => {
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === "/admin/riders"
            ? riders
            : {
                ...baseOrder,
                order_status: "ready_for_dispatch",
                allowed_next_statuses: [],
                assigned_rider_contact: {
                  display_name: "Juan",
                  delivery_assignment_id: 91,
                  delivery_status: "assigned",
                },
              },
      }),
    );

    render(<OrderShow />);

    expect(await screen.findByText("Assigned rider: Juan")).toBeInTheDocument();
  });
});
