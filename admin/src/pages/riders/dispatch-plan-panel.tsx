import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Space, Tag, Typography } from "antd";

import {
  createDispatchPlan,
  getDispatchPlan,
  reoptimizeDispatchPlan,
} from "@/services/dispatchPlansApi";
import type { DispatchPlan } from "@/types/dispatch-plan";
import { GridGoogleMap } from "@/components/google-map/grid-google-map";

const { Text } = Typography;
const lockedDeliveryStatuses = new Set(["picked_up", "on_the_way", "arrived"]);
const maximumDispatchStops = 5;

export interface DispatchPanelRider {
  id: number;
  fullName: string;
  assignmentEligible: boolean;
}

export interface DispatchAssignmentOption {
  assignmentId: number;
  orderRef: string;
  customerName: string | null;
  deliveryStatus?: string | null;
}

type PlanFailure = {
  message?: unknown;
  preservedPlan?: unknown;
};

function failureMessage(cause: unknown): string {
  const message = (cause as PlanFailure)?.message;
  return typeof message === "string"
    ? message
    : "Unable to load or update the dispatch route.";
}

function preservedPlan(cause: unknown): DispatchPlan | null {
  const plan = (cause as PlanFailure)?.preservedPlan;
  return plan && typeof plan === "object" ? (plan as DispatchPlan) : null;
}

function formatDuration(seconds: number) {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function formatDistance(meters: number) {
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

export function DispatchPlanPanel({
  rider,
  assignments,
}: {
  rider: DispatchPanelRider;
  assignments: DispatchAssignmentOption[];
}) {
  const defaultSelectedIds = () =>
    assignments
      .filter(
        (assignment) =>
          !lockedDeliveryStatuses.has(assignment.deliveryStatus ?? ""),
      )
      .map((assignment) => assignment.assignmentId)
      .slice(0, maximumDispatchStops);
  const [plan, setPlan] = useState<DispatchPlan | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>(defaultSelectedIds);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routingRetry, setRoutingRetry] = useState<
    "create" | "reoptimize" | null
  >(null);

  const assignmentById = useMemo(
    () =>
      new Map(
        assignments.map((assignment) => [assignment.assignmentId, assignment]),
      ),
    [assignments],
  );
  const lockedAssignmentIds = useMemo(() => {
    const activePlanAssignments = new Set(
      (plan?.stops ?? [])
        .filter((stop) => stop.status === "pending")
        .map((stop) => stop.assignment_id),
    );
    return new Set(
      assignments
        .filter(
          (assignment) =>
            activePlanAssignments.has(assignment.assignmentId) &&
            lockedDeliveryStatuses.has(assignment.deliveryStatus ?? ""),
        )
        .map((assignment) => assignment.assignmentId),
    );
  }, [assignments, plan]);
  const lockedAssignmentIdsKey = [...lockedAssignmentIds].sort().join(",");
  const assignmentIdsKey = assignments
    .map(
      (assignment) =>
        `${assignment.assignmentId}:${assignment.deliveryStatus ?? ""}`,
    )
    .sort()
    .join(",");

  const loadPlan = async () => {
    setLoading(true);
    setError(null);
    setRoutingRetry(null);
    try {
      setPlan(await getDispatchPlan(rider.id));
    } catch (cause) {
      setPlan(null);
      setError(failureMessage(cause));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedIds(defaultSelectedIds());
    void loadPlan();
    // Rider/profile identity is the dispatch resource boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider.id, assignmentIdsKey]);

  useEffect(() => {
    if (lockedAssignmentIds.size === 0) return;
    setSelectedIds((current) =>
      [...new Set([...lockedAssignmentIds, ...current])].slice(
        0,
        maximumDispatchStops,
      ),
    );
  }, [lockedAssignmentIds, lockedAssignmentIdsKey]);

  const createRoute = async () => {
    setMutating(true);
    setError(null);
    setRoutingRetry(null);
    try {
      setPlan(await createDispatchPlan(rider.id, selectedIds));
    } catch (cause) {
      setPlan(preservedPlan(cause));
      setError(failureMessage(cause));
      setRoutingRetry("create");
    } finally {
      setMutating(false);
    }
  };

  const reoptimizeRoute = async () => {
    setMutating(true);
    setError(null);
    setRoutingRetry(null);
    try {
      setPlan(await reoptimizeDispatchPlan(rider.id, selectedIds));
    } catch (cause) {
      const preserved = preservedPlan(cause);
      if (preserved) setPlan(preserved);
      setError(failureMessage(cause));
      setRoutingRetry("reoptimize");
    } finally {
      setMutating(false);
    }
  };

  return (
    <section aria-label={`Dispatch plan for ${rider.fullName}`}>
      <Card
        title={`Dispatch plan · ${rider.fullName}`}
        loading={loading}
        extra={
          plan ? (
            <Tag color={plan.routing_data_stale ? "orange" : "green"}>
              {plan.routing_data_stale ? "Stale route" : "Current route"}
            </Tag>
          ) : null
        }
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {error ? (
            <Alert
              type="error"
              showIcon
              message={error}
              action={
                routingRetry ? (
                  <Button
                    size="small"
                    aria-label={`Retry road routing for ${rider.fullName}`}
                    onClick={() =>
                      void (routingRetry === "create"
                        ? createRoute()
                        : reoptimizeRoute())
                    }
                  >
                    Retry road routing
                  </Button>
                ) : (
                  <Button size="small" onClick={() => void loadPlan()}>
                    Retry load
                  </Button>
                )
              }
            />
          ) : null}

          <Space direction="vertical" size="small" style={{ width: "100%" }}>
            <Text type="secondary">
              {selectedIds.length} {selectedIds.length === 1 ? "stop" : "stops"}{" "}
              selected
            </Text>
            {assignments.length > maximumDispatchStops ? (
              <Text type="secondary">
                Maximum {maximumDispatchStops} stops per route
              </Text>
            ) : null}
            <Checkbox.Group
              value={selectedIds}
              onChange={(values) => {
                const requested = values.map(Number);
                setSelectedIds(
                  [
                    ...new Set([
                      ...lockedAssignmentIds,
                      ...requested.filter(
                        (value) => !lockedAssignmentIds.has(value),
                      ),
                    ]),
                  ].slice(0, maximumDispatchStops),
                );
              }}
              style={{ width: "100%" }}
            >
              <Space direction="vertical" style={{ width: "100%" }}>
                {assignments.map((assignment) => (
                  <Checkbox
                    key={assignment.assignmentId}
                    value={assignment.assignmentId}
                    disabled={
                      lockedAssignmentIds.has(assignment.assignmentId) ||
                      (!selectedIds.includes(assignment.assignmentId) &&
                        selectedIds.length >= maximumDispatchStops)
                    }
                    aria-label={`Assignment ${assignment.orderRef}`}
                  >
                    <Text strong>{assignment.customerName ?? "Customer"}</Text>
                    {` · ${assignment.orderRef} · assignment #${assignment.assignmentId}`}
                    {lockedAssignmentIds.has(assignment.assignmentId)
                      ? " · in transit"
                      : ""}
                  </Checkbox>
                ))}
              </Space>
            </Checkbox.Group>
          </Space>

          {plan ? (
            <>
              <Space wrap>
                <Text strong>
                  {plan.provider.toUpperCase()} · {plan.profile} · v
                  {plan.version}
                </Text>
                <Text type="secondary">
                  {formatDuration(plan.total_duration_seconds)} ·{" "}
                  {formatDistance(plan.total_distance_meters)}
                </Text>
              </Space>
              <GridGoogleMap
                center={{
                  lat: plan.origin_latitude,
                  lng: plan.origin_longitude,
                }}
                zoom={13}
                height={280}
                markers={[
                  {
                    id: "origin",
                    position: {
                      lat: plan.origin_latitude,
                      lng: plan.origin_longitude,
                    },
                    title: "Store origin",
                  },
                  ...plan.stops.map((stop) => ({
                    id: `stop-${stop.id}`,
                    position: {
                      lat: stop.destination_latitude,
                      lng: stop.destination_longitude,
                    },
                    title: `#${stop.sequence} ${
                      assignmentById.get(stop.assignment_id)?.customerName ??
                      stop.order_ref ??
                      "Stop"
                    }`,
                  })),
                ]}
                polylines={plan.stops
                  .filter(
                    (stop) =>
                      stop.leg_geometry?.type === "LineString" &&
                      Array.isArray(stop.leg_geometry.coordinates) &&
                      stop.leg_geometry.coordinates.length >= 2,
                  )
                  .map((stop) => ({
                    id: `leg-${stop.id}`,
                    path: stop.leg_geometry.coordinates.map(([lng, lat]) => ({
                      lat,
                      lng,
                    })),
                    color:
                      stop.status === "completed"
                        ? "#8B8B8B"
                        : stop.status === "pending"
                          ? "#FFDE58"
                          : "#666666",
                    weight: 4,
                  }))}
                fitPositions={[
                  {
                    lat: plan.origin_latitude,
                    lng: plan.origin_longitude,
                  },
                  ...plan.stops.map((stop) => ({
                    lat: stop.destination_latitude,
                    lng: stop.destination_longitude,
                  })),
                ]}
              />
              <Space direction="vertical" style={{ width: "100%" }}>
                {plan.stops.map((stop) => {
                  const assignment = assignmentById.get(stop.assignment_id);
                  return (
                    <div
                      key={stop.id}
                      data-testid={`dispatch-stop-${stop.sequence}`}
                      style={{
                        border: "1px solid #303030",
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <Text strong>
                        #{stop.sequence}{" "}
                        {assignment?.customerName ?? "Customer"}
                      </Text>
                      <br />
                      <Text type="secondary">
                        {stop.order_ref ??
                          assignment?.orderRef ??
                          `Assignment #${stop.assignment_id}`}
                        {` · ${formatDuration(stop.leg_duration_seconds)} · ${formatDistance(stop.leg_distance_meters)}`}
                      </Text>
                    </div>
                  );
                })}
              </Space>
            </>
          ) : (
            <Text type="secondary">
              No persisted route exists for this rider yet.
            </Text>
          )}

          {plan ? (
            <Button
              type="primary"
              loading={mutating}
              disabled={selectedIds.length === 0}
              aria-label={`Re-optimize remaining route for ${rider.fullName}`}
              onClick={() => void reoptimizeRoute()}
            >
              Re-optimize remaining route
            </Button>
          ) : (
            <Button
              type="primary"
              loading={mutating}
              disabled={selectedIds.length === 0 || !rider.assignmentEligible}
              aria-label={`Create road route for ${rider.fullName}`}
              onClick={() => void createRoute()}
            >
              Create road route
            </Button>
          )}
        </Space>
      </Card>
    </section>
  );
}
