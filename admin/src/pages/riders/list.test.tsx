// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RiderList } from "./list";

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("@/providers/api-client", () => ({
  apiClient: { get: mockGet, post: vi.fn() },
}));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TileLayer: () => null,
  Marker: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Popup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("leaflet", () => {
  class DivIcon {}
  return {
    default: {
      Icon: {
        Default: { prototype: {}, mergeOptions: vi.fn() },
      },
    },
    DivIcon,
  };
});

const riders = [
  {
    id: 10,
    user_id: 100,
    full_name: "Juan",
    email: "juan@example.test",
    vehicle_type: "motorcycle",
    plate_number: "JUAN-1",
    is_available: true,
    assignment_eligible: false,
  },
  {
    id: 11,
    user_id: 101,
    full_name: "Maria",
    email: "maria@example.test",
    vehicle_type: "motorcycle",
    plate_number: "MARIA-1",
    is_available: true,
    assignment_eligible: true,
  },
];

const readyOrder = {
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
  order_status: "ready_for_dispatch",
  allowed_next_statuses: [],
  delivery_option: "delivery",
  created_at: "2026-07-10T10:00:00.000Z",
  updated_at: "2026-07-10T10:00:00.000Z",
};

describe("RiderList", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("shows rider fetch failures and offers a retry without mock metrics", async () => {
    mockGet.mockImplementation((url: string) =>
      url === "/admin/riders"
        ? Promise.reject(new Error("Rider request failed"))
        : Promise.resolve({ data: [] }),
    );

    render(<RiderList />);

    expect(await screen.findByText("Rider request failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry riders" })).toBeInTheDocument();
    expect(screen.queryByText("Total Deliveries")).not.toBeInTheDocument();
  });

  it("offers assignment only to server-eligible riders", async () => {
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({ data: url === "/admin/riders" ? riders : [readyOrder] }),
    );

    render(<RiderList />);

    fireEvent.click(await screen.findByRole("button", { name: "Assign rider for ORD-MARK" }));

    expect(screen.getByLabelText("Assign ORD-MARK to Maria")).toBeInTheDocument();
    expect(screen.queryByLabelText("Assign ORD-MARK to Juan")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Available/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Online/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Offline/)).not.toBeInTheDocument();
    expect(screen.queryByText(/On delivery/)).not.toBeInTheDocument();
  });

  it("names the live-map toggle and uses readable muted rider text", async () => {
    mockGet.mockImplementation((url: string) =>
      Promise.resolve({ data: url === "/admin/riders" ? riders : [] }),
    );

    render(<RiderList />);

    const expand = await screen.findByRole("button", {
      name: "Expand live tracking map",
    });
    fireEvent.click(expand);
    expect(
      screen.getByRole("button", { name: "Collapse live tracking map" }),
    ).toBeInTheDocument();
    expect(screen.getByText("juan@example.test")).toHaveStyle({
      color: "#A0A0A0",
    });
    expect(screen.getByText("JUAN-1")).toHaveStyle({ color: "#A0A0A0" });
  });
});
