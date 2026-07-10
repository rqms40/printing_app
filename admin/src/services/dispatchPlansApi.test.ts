import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DispatchPlanApiError,
  createDispatchPlan,
  getDispatchPlan,
  reoptimizeDispatchPlan,
} from "./dispatchPlansApi";

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock("@/providers/api-client", () => ({
  apiClient: { get: mockGet, post: mockPost },
}));

const planPayload = {
  id: 12,
  riderId: 10,
  version: 1,
  status: "active",
  originLatitude: "7.0640000",
  originLongitude: "125.6079000",
  provider: "osrm",
  profile: "driving",
  totalDurationSeconds: 352,
  totalDistanceMeters: 2188,
  routingDataStale: false,
  plannedAt: "2026-07-10T10:00:00.000Z",
  stops: [
    {
      id: 21,
      planId: 12,
      assignmentId: 201,
      sequence: 1,
      status: "pending",
      destinationLatitude: "7.0710000",
      destinationLongitude: "125.6120000",
      legDurationSeconds: 182,
      legDistanceMeters: 1054,
      legGeometry: {
        type: "LineString",
        coordinates: [[125.6079, 7.064], [125.612, 7.071]],
      },
      assignment: { order: { orderId: "ORD-VEN" } },
    },
    {
      id: 22,
      planId: 12,
      assignmentId: 202,
      sequence: 2,
      status: "pending",
      destinationLatitude: "7.0900000",
      destinationLongitude: "125.6200000",
      legDurationSeconds: 170,
      legDistanceMeters: 1134,
      legGeometry: {
        type: "LineString",
        coordinates: [[125.612, 7.071], [125.62, 7.09]],
      },
      assignment: { order: { orderId: "ORD-MARK" } },
    },
  ],
};

describe("dispatchPlansApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the persisted plan by rider profile id", async () => {
    mockGet.mockResolvedValue({ data: planPayload });

    await expect(getDispatchPlan(10)).resolves.toMatchObject({
      rider_profile_id: 10,
      version: 1,
    });
    expect(mockGet).toHaveBeenCalledWith("/admin/riders/10/dispatch-plan");
  });

  it("creates using assignment ids then refetches the complete persisted plan", async () => {
    mockPost.mockResolvedValue({ data: { id: 12 } });
    mockGet.mockResolvedValue({ data: planPayload });

    await expect(createDispatchPlan(10, [202, 201])).resolves.toMatchObject({
      rider_profile_id: 10,
      version: 1,
    });
    expect(mockPost).toHaveBeenCalledWith(
      "/admin/riders/10/dispatch-plan",
      { assignmentIds: [202, 201] },
    );
    expect(mockGet).toHaveBeenCalledAfter(mockPost);
  });

  it("surfaces an initial routing_unavailable without fabricating a plan", async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 503,
        data: {
          code: "routing_unavailable",
          message: "Road routing is temporarily unavailable",
        },
      },
    });

    await expect(createDispatchPlan(10, [201, 202])).rejects.toMatchObject({
      code: "routing_unavailable",
      preservedPlan: null,
    });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("refetches and exposes the stale prior plan after re-optimization fails", async () => {
    mockPost.mockRejectedValue({
      response: {
        status: 503,
        data: {
          code: "routing_unavailable",
          message: "Road routing is temporarily unavailable",
        },
      },
    });
    mockGet.mockResolvedValue({
      data: { ...planPayload, routingDataStale: true },
    });

    const error = await reoptimizeDispatchPlan(10, [201, 202]).catch(
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(DispatchPlanApiError);
    expect(error).toMatchObject({
      code: "routing_unavailable",
      preservedPlan: { version: 1, routing_data_stale: true },
    });
    expect(mockPost).toHaveBeenCalledWith(
      "/admin/riders/10/dispatch-plan/re-optimize",
      { assignmentIds: [201, 202] },
    );
    expect(mockGet).toHaveBeenCalledAfter(mockPost);
  });

  it("refetches the complete new version after successful re-optimization", async () => {
    mockPost.mockResolvedValue({ data: { version: 2 } });
    mockGet.mockResolvedValue({
      data: { ...planPayload, version: 2 },
    });

    await expect(reoptimizeDispatchPlan(10)).resolves.toMatchObject({
      version: 2,
      routing_data_stale: false,
    });
    expect(mockPost).toHaveBeenCalledWith(
      "/admin/riders/10/dispatch-plan/re-optimize",
      {},
    );
    expect(mockGet).toHaveBeenCalledAfter(mockPost);
  });
});
