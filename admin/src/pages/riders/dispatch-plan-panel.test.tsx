// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DispatchPlan } from "@/types/dispatch-plan";
import { DispatchPlanPanel } from "./dispatch-plan-panel";

const { mockCreate, mockGet, mockReoptimize } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockGet: vi.fn(),
  mockReoptimize: vi.fn(),
}));

vi.mock("@/services/dispatchPlansApi", () => ({
  createDispatchPlan: mockCreate,
  getDispatchPlan: mockGet,
  reoptimizeDispatchPlan: mockReoptimize,
}));

const returnedPlan: DispatchPlan = {
  id: 12,
  rider_profile_id: 10,
  version: 1,
  status: "active",
  origin_latitude: 7.064,
  origin_longitude: 125.6079,
  provider: "osrm",
  profile: "driving",
  total_duration_seconds: 352,
  total_distance_meters: 2188,
  routing_data_stale: false,
  planned_at: "2026-07-10T10:00:00.000Z",
  stops: [
    {
      id: 21,
      plan_id: 12,
      assignment_id: 201,
      sequence: 1,
      status: "pending",
      kind: "dropoff",
      destination_latitude: 7.071,
      destination_longitude: 125.612,
      leg_duration_seconds: 182,
      leg_distance_meters: 1054,
      leg_geometry: {
        type: "LineString",
        coordinates: [
          [125.6079, 7.064],
          [125.612, 7.071],
        ],
      },
      order_ref: "ORD-VEN",
      completed_at: null,
      skipped_at: null,
    },
    {
      id: 22,
      plan_id: 12,
      assignment_id: 202,
      sequence: 2,
      status: "pending",
      kind: "dropoff",
      destination_latitude: 7.09,
      destination_longitude: 125.62,
      leg_duration_seconds: 170,
      leg_distance_meters: 1134,
      leg_geometry: {
        type: "LineString",
        coordinates: [
          [125.612, 7.071],
          [125.62, 7.09],
        ],
      },
      order_ref: "ORD-MARK",
      completed_at: null,
      skipped_at: null,
    },
  ],
};

const assignments = [
  { assignmentId: 202, orderRef: "ORD-MARK", customerName: "Mark" },
  { assignmentId: 201, orderRef: "ORD-VEN", customerName: "Ven" },
];

describe("DispatchPlanPanel", () => {
  beforeEach(() => {
    mockGet.mockResolvedValue(null);
    mockCreate.mockResolvedValue(returnedPlan);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("submits assignment ids but renders the persisted Ven then Mark sequence", async () => {
    render(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={assignments}
      />,
    );

    expect(
      await screen.findByLabelText("Dispatch plan for Juan"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Create road route for Juan" }),
    );

    expect(mockCreate).toHaveBeenCalledWith(10, [202, 201]);
    expect(await screen.findByTestId("dispatch-stop-1")).toHaveTextContent(
      "Ven",
    );
    expect(screen.getByTestId("dispatch-stop-2")).toHaveTextContent("Mark");
    expect(screen.getByText("OSRM · driving · v1")).toBeInTheDocument();
  });

  it("commits a deselection before creating the route", async () => {
    const panelAssignments = [
      ...assignments,
      { assignmentId: 199, orderRef: "ORD-SEED", customerName: "Maria" },
    ];
    const { rerender } = render(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={panelAssignments}
      />,
    );

    expect(await screen.findByText("3 stops selected")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Assignment ORD-SEED"));
    expect(await screen.findByText("2 stops selected")).toBeInTheDocument();
    rerender(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={[...panelAssignments].reverse()}
      />,
    );
    expect(await screen.findByText("2 stops selected")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Create road route for Juan" }),
    );

    expect(mockCreate).toHaveBeenCalledWith(10, [202, 201]);
  });

  it("keeps an active-plan on-the-way assignment selected and locked", async () => {
    mockGet.mockResolvedValue({
      ...returnedPlan,
      stops: [
        ...returnedPlan.stops,
        {
          ...returnedPlan.stops[0],
          id: 23,
          assignment_id: 199,
          sequence: 3,
          order_ref: "ORD-SEED",
        },
      ],
    });
    render(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={[
          ...assignments,
          {
            assignmentId: 199,
            orderRef: "ORD-SEED",
            customerName: "Maria",
            deliveryStatus: "on_the_way",
          },
        ]}
      />,
    );

    expect(await screen.findByText("3 stops selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Assignment ORD-SEED")).toBeChecked();
    expect(screen.getByLabelText("Assignment ORD-SEED")).toBeDisabled();
  });

  it("does not lock an unrelated on-the-way assignment without an active plan", async () => {
    render(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={[
          ...assignments,
          {
            assignmentId: 199,
            orderRef: "ORD-SEED",
            customerName: "Maria",
            deliveryStatus: "on_the_way",
          },
        ]}
      />,
    );

    expect(await screen.findByText("2 stops selected")).toBeInTheDocument();
    expect(screen.getByLabelText("Assignment ORD-SEED")).not.toBeChecked();
    expect(screen.getByLabelText("Assignment ORD-SEED")).toBeEnabled();
  });

  it("keeps a stale prior plan visible when re-optimization routing fails", async () => {
    mockGet.mockResolvedValue({ ...returnedPlan, routing_data_stale: false });
    mockReoptimize.mockRejectedValue({
      code: "routing_unavailable",
      message: "Road routing is temporarily unavailable",
      preservedPlan: { ...returnedPlan, routing_data_stale: true },
    });

    render(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={assignments}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Re-optimize remaining route for Juan",
      }),
    );

    expect(await screen.findByText("Stale route")).toBeInTheDocument();
    expect(screen.getByTestId("dispatch-stop-1")).toHaveTextContent("Ven");
    expect(
      screen.getByText("Road routing is temporarily unavailable"),
    ).toBeInTheDocument();
  });

  it("retries the failed road-routing mutation instead of only refetching", async () => {
    mockCreate
      .mockRejectedValueOnce({
        code: "routing_unavailable",
        message: "Road routing is temporarily unavailable",
        preservedPlan: null,
      })
      .mockResolvedValueOnce(returnedPlan);

    render(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={assignments}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Create road route for Juan" }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Retry road routing for Juan",
      }),
    );

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("Current route")).toBeInTheDocument();
  });

  it("selects assignments added for the same rider before route creation", async () => {
    const { rerender } = render(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={[assignments[0]]}
      />,
    );

    rerender(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={assignments}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Create road route for Juan" }),
    );

    expect(mockCreate).toHaveBeenCalledWith(10, [202, 201]);
  });

  it("caps a dispatch plan at the server maximum of five stops", async () => {
    const sixAssignments = Array.from({ length: 6 }, (_, index) => ({
      assignmentId: 301 + index,
      orderRef: `ORD-${index + 1}`,
      customerName: `Customer ${index + 1}`,
    }));

    render(
      <DispatchPlanPanel
        rider={{ id: 10, fullName: "Juan", assignmentEligible: true }}
        assignments={sixAssignments}
      />,
    );

    expect(await screen.findByText("5 stops selected")).toBeInTheDocument();
    expect(screen.getByText("Maximum 5 stops per route")).toBeInTheDocument();
    expect(screen.getByLabelText("Assignment ORD-6")).not.toBeChecked();
    expect(screen.getByLabelText("Assignment ORD-6")).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Create road route for Juan" }),
    );
    expect(mockCreate).toHaveBeenCalledWith(10, [301, 302, 303, 304, 305]);
  });
});
