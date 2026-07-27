import React, { useState, useEffect } from "react";
import {
  Table,
  Tag,
  Avatar,
  Space,
  Typography,
  Input,
  Tooltip,
  Card,
  Badge,
  Button,
  Row,
  Col,
  Segmented,
  Statistic,
  App,
  Alert,
} from "antd";
import {
  SearchOutlined,
  EnvironmentOutlined,
  CarOutlined,
  UserAddOutlined,
  DropboxOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExpandOutlined,
  CompressOutlined,
} from "@ant-design/icons";
import { formatDateTime, formatRelativeTime } from "@/utils/format";
import { apiClient } from "@/providers/api-client";
import { normalizeAdminRiders, normalizeOrders } from "@/utils/api-normalizers";
import type { Order } from "@/types/order";
import { DispatchPlanPanel } from "./dispatch-plan-panel";
import { GridGoogleMap } from "@/components/google-map/grid-google-map";

const { Text, Title } = Typography;
const MUTED_TEXT = "#A0A0A0";

/* ─── API Rider type ────────────────────────────────────────────── */
interface ApiRider {
  id: number;
  user_id: number;
  full_name: string | null;
  email: string | null;
  vehicle_type: string;
  plate_number: string | null;
  is_available: boolean;
  assignment_eligible: boolean;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_update: string | null;
  created_at: string;
  updated_at: string;
}

const VEHICLE_COLORS: Record<string, string> = {
  motorcycle: "#FFCA28",
  bicycle: "#66BB6A",
  car: "#42A5F5",
};

/* ─── Styles ────────────────────────────────────────────────────── */
const S = {
  card: {
    background: "#141414",
    border: "1px solid #2E2E2E",
    borderRadius: 12,
  } as React.CSSProperties,
  cardInner: {
    background: "#1A1A1A",
    border: "1px solid #252525",
    borderRadius: 10,
  } as React.CSSProperties,
  metricValue: {
    color: "#F0F0F0",
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.1,
    fontFamily: "'DM Sans', sans-serif",
  } as React.CSSProperties,
  metricLabel: {
    color: MUTED_TEXT,
    fontSize: 11,
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  } as React.CSSProperties,
  sectionTitle: {
    color: "#F0F0F0",
    fontWeight: 600,
    fontSize: 15,
    margin: 0,
  } as React.CSSProperties,
};

/* ─── Main Riders Page ──────────────────────────────────────────── */
export function RiderList() {
  const { message } = App.useApp();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "unavailable"
  >("all");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [riders, setRiders] = useState<ApiRider[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingRiders, setLoadingRiders] = useState(true);
  const [riderError, setRiderError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedRiderId, setSelectedRiderId] = useState<number | null>(null);

  useEffect(() => {
    setLoadingRiders(true);
    setRiderError(null);
    setOrderError(null);
    void apiClient
      .get("/admin/riders")
      .then((r) => setRiders(normalizeAdminRiders(r.data) as ApiRider[]))
      .catch((cause: unknown) => {
        setRiders([]);
        setRiderError(
          cause instanceof Error ? cause.message : "Unable to load riders",
        );
      })
      .finally(() => setLoadingRiders(false));
    void apiClient
      .get("/admin/orders")
      .then((r) => setOrders(normalizeOrders(r.data)))
      .catch((cause: unknown) => {
        setOrders([]);
        setOrderError(
          cause instanceof Error ? cause.message : "Unable to load orders",
        );
      });
  }, [reloadKey]);

  // Live Tracking accuracy: rider GPS lands in /admin/riders as
  // last_latitude/longitude, so poll quietly while the page is open — the
  // map marker and "Last Seen" follow the rider instead of a stale snapshot.
  useEffect(() => {
    const interval = window.setInterval(() => {
      void apiClient
        .get("/admin/riders")
        .then((r) => setRiders(normalizeAdminRiders(r.data) as ApiRider[]))
        .catch(() => {
          // Keep the last successful snapshot on transient poll failures.
        });
    }, 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleAssignRider = async (
    orderId: number | string,
    riderId: number,
  ) => {
    try {
      await apiClient.post(`/admin/orders/${orderId}/assign`, { riderId });
      void message.success("Rider assigned successfully");
      const res = await apiClient.get("/admin/orders");
      setOrders(normalizeOrders(res.data));
    } catch {
      void message.error("Failed to assign rider");
    }
  };

  const availableCount = riders.filter((d) => d.is_available).length;
  const unavailableCount = riders.length - availableCount;
  const activeTrips = orders.filter((order) => {
    const status = order.assigned_rider_contact?.delivery_status;
    return status != null && !["declined", "delivered"].includes(status);
  }).length;
  const readyOrders = orders.filter(
    (order) =>
      order.order_status === "ready_for_dispatch" &&
      order.delivery_option === "delivery",
  );
  const selectedRider = riders.find((rider) => rider.id === selectedRiderId);
  const selectedAssignments = selectedRider
    ? orders.flatMap((order) => {
        const contact = order.assigned_rider_contact;
        const riderProfileId = Number(contact?.rider_profile_id);
        const assignmentId = Number(contact?.delivery_assignment_id);
        if (
          riderProfileId !== selectedRider.id ||
          !Number.isInteger(assignmentId) ||
          assignmentId <= 0 ||
          contact?.delivery_status === "declined" ||
          contact?.delivery_status === "delivered"
        ) {
          return [];
        }
        return [
          {
            assignmentId,
            orderRef: order.order_id,
            customerName: order.customer_name ?? null,
            deliveryStatus: contact?.delivery_status ?? null,
          },
        ];
      })
    : [];

  const filtered = riders.filter((d) => {
    const matchesSearch =
      !search ||
      d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.plate_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "available"
          ? d.is_available
          : !d.is_available;
    return matchesSearch && matchesStatus;
  });

  // Center on the riders we can actually see; fall back to the city default.
  // Rounded so the remount key only changes when riders move meaningfully.
  const located = riders.filter((d) => d.last_latitude && d.last_longitude);
  const mapCenter: [number, number] = located.length
    ? [
        Number(
          (
            located.reduce((sum, d) => sum + Number(d.last_latitude), 0) /
            located.length
          ).toFixed(3),
        ),
        Number(
          (
            located.reduce((sum, d) => sum + Number(d.last_longitude), 0) /
            located.length
          ).toFixed(3),
        ),
      ]
    : [7.132836, 125.610605];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        paddingBottom: 40,
      }}
    >
      {riderError ? (
        <Alert
          type="error"
          showIcon
          message={riderError}
          action={
            <Button
              aria-label="Retry riders"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Retry
            </Button>
          }
        />
      ) : null}
      {orderError ? (
        <Alert
          type="error"
          showIcon
          message={orderError}
          action={
            <Button
              aria-label="Retry orders"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Retry
            </Button>
          }
        />
      ) : null}

      {/* ── Header Row ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <Title
            level={3}
            style={{ color: "#F0F0F0", margin: 0, marginBottom: 4 }}
          >
            Riders
          </Title>
          <Space size={8}>
            <Badge
              status="success"
              text={
                <Text style={{ color: "#808080", fontSize: 13 }}>
                  {availableCount} Available
                </Text>
              }
            />
            <Badge
              status="default"
              text={
                <Text style={{ color: "#808080", fontSize: 13 }}>
                  {unavailableCount} Unavailable
                </Text>
              }
            />
          </Space>
        </div>
      </div>

      {/* ── Metric Strip ───────────────────────────────────────── */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8}>
          <Card style={S.card} styles={{ body: { padding: "16px 20px" } }}>
            <Statistic
              title={<span style={S.metricLabel}>Total Riders</span>}
              value={riders.length}
              valueStyle={S.metricValue}
              prefix={
                <CarOutlined
                  style={{ color: "#FFDE58", fontSize: 16, marginRight: 4 }}
                />
              }
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card style={S.card} styles={{ body: { padding: "16px 20px" } }}>
            <Statistic
              title={<span style={S.metricLabel}>Active Trips</span>}
              value={activeTrips}
              valueStyle={S.metricValue}
              prefix={
                <EnvironmentOutlined
                  style={{ color: "#42A5F5", fontSize: 16, marginRight: 4 }}
                />
              }
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card style={S.card} styles={{ body: { padding: "16px 20px" } }}>
            <Statistic
              title={<span style={S.metricLabel}>Awaiting Dispatch</span>}
              value={readyOrders.length}
              valueStyle={{ ...S.metricValue, color: "#FFDE58" }}
              prefix={
                <ClockCircleOutlined
                  style={{ color: "#FFDE58", fontSize: 16, marginRight: 4 }}
                />
              }
            />
          </Card>
        </Col>
      </Row>

      {/* ── Map + Dispatch Row ─────────────────────────────────── */}
      <Row gutter={[16, 16]}>
        {/* Live Map */}
        <Col xs={24} lg={mapExpanded ? 24 : 16}>
          <Card
            style={{ ...S.card, overflow: "hidden" }}
            styles={{
              header: {
                borderBottom: "1px solid #2E2E2E",
                padding: "12px 20px",
                minHeight: "auto",
              },
              body: { padding: 0 },
            }}
            title={
              <Space size={8}>
                <EnvironmentOutlined
                  style={{ color: "#FFDE58", fontSize: 14 }}
                />
                <span
                  style={{ color: "#F0F0F0", fontWeight: 600, fontSize: 14 }}
                >
                  Live Tracking
                </span>
              </Space>
            }
            extra={
              <Button
                type="text"
                size="small"
                aria-label={
                  mapExpanded
                    ? "Collapse live tracking map"
                    : "Expand live tracking map"
                }
                icon={mapExpanded ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={() => setMapExpanded((v) => !v)}
                style={{ color: MUTED_TEXT }}
              />
            }
          >
            <div
              style={{
                position: "relative",
                zIndex: 0,
                height: mapExpanded ? 500 : 340,
                width: "100%",
                isolation: "isolate",
              }}
            >
              <GridGoogleMap
                key={mapCenter.join(",")}
                center={{ lat: mapCenter[0], lng: mapCenter[1] }}
                zoom={13}
                height="100%"
                markers={riders
                  .filter((d) => d.last_latitude && d.last_longitude)
                  .map((d) => ({
                    id: `rider-${d.id}`,
                    position: {
                      lat: Number(d.last_latitude),
                      lng: Number(d.last_longitude),
                    },
                    title: `${d.full_name ?? d.email ?? "Rider"} · ${
                      d.is_available ? "Available" : "Unavailable"
                    } · ${d.vehicle_type}${
                      d.plate_number ? ` · ${d.plate_number}` : ""
                    }`,
                    color: d.is_available ? "#34d399" : "#808080",
                  }))}
              />

              {/* Map legend overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: 12,
                  left: 12,
                  zIndex: 1000,
                  background: "rgba(20,20,20,0.9)",
                  backdropFilter: "blur(8px)",
                  borderRadius: 8,
                  padding: "8px 14px",
                  display: "flex",
                  gap: 16,
                  fontSize: 12,
                  color: "#A0A0A0",
                  border: "1px solid #2E2E2E",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#34d399",
                      display: "inline-block",
                    }}
                  />
                  Available
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#60a5fa",
                      display: "inline-block",
                    }}
                  />
                  Unavailable
                </span>
              </div>
            </div>
          </Card>
        </Col>

        {/* Dispatch Queue */}
        {!mapExpanded && (
          <Col xs={24} lg={8}>
            <DispatchPanel
              readyOrders={readyOrders}
              availRiders={riders.filter((d) => d.assignment_eligible)}
              onAssign={handleAssignRider}
            />
          </Col>
        )}
      </Row>

      {/* ── Rider Table ───────────────────────────────────────── */}
      <div className="riders-table-section">
        {/* Toolbar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 20px",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <span style={S.sectionTitle}>All Riders</span>
          <Space size={12} wrap>
            <Segmented
              size="small"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={[
                { label: `All (${riders.length})`, value: "all" },
                { label: `Available (${availableCount})`, value: "available" },
                {
                  label: `Unavailable (${unavailableCount})`,
                  value: "unavailable",
                },
              ]}
              style={{ background: "#1A1A1A" }}
            />
            <Input
              placeholder="Search name or plate..."
              prefix={<SearchOutlined style={{ color: "#555" }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 200 }}
              size="small"
            />
          </Space>
        </div>

        {/* Table */}
        <Table
          dataSource={filtered}
          rowKey="id"
          size="middle"
          scroll={{ x: 640 }}
          pagination={false}
          loading={loadingRiders}
        >
          <Table.Column
            title="Rider"
            width={240}
            render={(_: unknown, record: ApiRider) => (
              <Space size={12}>
                <div style={{ position: "relative" }}>
                  <Avatar
                    size={38}
                    style={{
                      background: record.is_available ? "#132B13" : "#1E1E1E",
                      color: record.is_available ? "#66BB6A" : MUTED_TEXT,
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {(record.full_name ?? record.email)
                      ?.charAt(0)
                      ?.toUpperCase() ?? "?"}
                  </Avatar>
                  <span
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: record.is_available ? "#34d399" : "#444",
                      border: "2px solid #141414",
                    }}
                  />
                </div>
                <div>
                  <Text
                    strong
                    style={{
                      color: "#F0F0F0",
                      display: "block",
                      fontSize: 13.5,
                      lineHeight: 1.3,
                    }}
                  >
                    {record.full_name ?? record.email ?? "Unknown"}
                  </Text>
                  <Text style={{ color: MUTED_TEXT, fontSize: 11.5 }}>
                    {record.email ?? `ID: ${record.user_id}`}
                  </Text>
                </div>
              </Space>
            )}
          />

          <Table.Column
            dataIndex="vehicle_type"
            title="Vehicle"
            width={150}
            render={(v: string, record: ApiRider) => (
              <Space size={8}>
                <CarOutlined
                  style={{
                    color: VEHICLE_COLORS[v] ?? "#808080",
                    fontSize: 15,
                  }}
                />
                <div>
                  <Text
                    style={{
                      color: "#F0F0F0",
                      display: "block",
                      fontSize: 13,
                      textTransform: "capitalize",
                    }}
                  >
                    {v}
                  </Text>
                  <Text
                    style={{
                      color: MUTED_TEXT,
                      fontSize: 11.5,
                      fontFamily: "monospace",
                    }}
                  >
                    {record.plate_number ?? "—"}
                  </Text>
                </div>
              </Space>
            )}
          />

          <Table.Column
            dataIndex="is_available"
            title="Status"
            width={110}
            render={(available: boolean) => (
              <Tag
                color={available ? "green" : "default"}
                style={{ borderRadius: 10, fontSize: 12, padding: "1px 10px" }}
              >
                {available ? "Available" : "Unavailable"}
              </Tag>
            )}
          />

          <Table.Column
            title="Assignments"
            width={110}
            render={(_: unknown, record: ApiRider) => {
              const count = orders.filter(
                (order) =>
                  Number(order.assigned_rider_contact?.rider_profile_id) ===
                  record.id,
              ).length;
              return <Text>{count}</Text>;
            }}
          />

          <Table.Column
            dataIndex="last_location_update"
            title="Last Seen"
            width={140}
            render={(v: string | undefined, record: ApiRider) =>
              record.last_latitude ? (
                <Tooltip title={v ? formatDateTime(v) : "Location available"}>
                  <Space size={4}>
                    <EnvironmentOutlined
                      style={{ color: MUTED_TEXT, fontSize: 12 }}
                    />
                    <span style={{ color: "#808080", fontSize: 12.5 }}>
                      {v ? formatRelativeTime(v) : "GPS active"}
                    </span>
                  </Space>
                </Tooltip>
              ) : (
                <span style={{ color: MUTED_TEXT, fontSize: 12.5 }}>
                  No location
                </span>
              )
            }
          />
          <Table.Column
            title="Route"
            width={130}
            render={(_: unknown, record: ApiRider) => (
              <Button
                size="small"
                aria-label={`Dispatch plan for ${record.full_name ?? record.email ?? record.id}`}
                onClick={() => setSelectedRiderId(record.id)}
              >
                Dispatch plan
              </Button>
            )}
          />
        </Table>
      </div>

      {selectedRider ? (
        <DispatchPlanPanel
          rider={{
            id: selectedRider.id,
            fullName:
              selectedRider.full_name ??
              selectedRider.email ??
              `Rider ${selectedRider.id}`,
            assignmentEligible: selectedRider.assignment_eligible,
          }}
          assignments={selectedAssignments}
        />
      ) : null}
    </div>
  );
}

/* ─── Dispatch Panel ─────────────────────────────────────────────── */
const DispatchPanel: React.FC<{
  readyOrders: Order[];
  availRiders: ApiRider[];
  onAssign: (orderId: number | string, riderId: number) => Promise<void>;
}> = ({ readyOrders, availRiders, onAssign }) => {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assigningInProgress, setAssigningInProgress] = useState(false);

  const handleRiderselect = async (
    orderId: number | string,
    riderId: number,
  ) => {
    setAssigningInProgress(true);
    await onAssign(orderId, riderId);
    setAssigning(null);
    setAssigningInProgress(false);
  };

  return (
    <Card
      style={{
        background: "#141414",
        border: "1px solid #2E2E2E",
        borderRadius: 12,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
      styles={{
        header: {
          borderBottom: "1px solid #2E2E2E",
          padding: "12px 20px",
          minHeight: "auto",
        },
        body: { padding: 12, flex: 1, overflowY: "auto", maxHeight: 280 },
      }}
      title={
        <span style={{ color: "#F0F0F0", fontWeight: 600, fontSize: 14 }}>
          Dispatch Queue
        </span>
      }
      extra={
        readyOrders.length > 0 && (
          <Badge
            count={readyOrders.length}
            style={{
              backgroundColor: "#FFDE58",
              color: "#141414",
              fontWeight: 700,
              fontSize: 11,
            }}
          />
        )
      }
    >
      {readyOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <CheckCircleOutlined
            style={{ fontSize: 28, color: "#333", marginBottom: 8 }}
          />
          <Text style={{ display: "block", color: MUTED_TEXT, fontSize: 13 }}>
            All orders dispatched
          </Text>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {readyOrders.map((order) => (
            <div
              key={order.order_id ?? order.id}
              style={{
                background: "#1A1A1A",
                borderRadius: 10,
                padding: 14,
                border: "1px solid #252525",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                }}
              >
                <div>
                  <Text
                    strong
                    style={{
                      color: "#F0F0F0",
                      display: "block",
                      fontSize: 13.5,
                    }}
                  >
                    {order.order_id ?? order.id}
                  </Text>
                  <Text
                    style={{
                      color: MUTED_TEXT,
                      fontSize: 11.5,
                      textTransform: "capitalize",
                    }}
                  >
                    Type: {order.category ?? "Parcel"}
                  </Text>
                </div>
                <div
                  style={{
                    background: "rgba(34, 197, 94, 0.08)",
                    padding: "5px 7px",
                    borderRadius: 8,
                  }}
                >
                  <DropboxOutlined style={{ color: "#34d399", fontSize: 16 }} />
                </div>
              </div>

              {assigning === (order.order_id ?? order.id) ? (
                <div>
                  <Text
                    style={{
                      color: MUTED_TEXT,
                      fontSize: 11,
                      display: "block",
                      marginBottom: 6,
                    }}
                  >
                    Select rider:
                  </Text>
                  {availRiders.map((rider) => (
                    <button
                      type="button"
                      key={rider.id}
                      aria-label={`Assign ${order.order_id} to ${rider.full_name ?? rider.email ?? rider.id}`}
                      onClick={() =>
                        !assigningInProgress &&
                        void handleRiderselect(
                          order.id ?? order.order_id,
                          rider.id,
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign: "left",
                        cursor: assigningInProgress ? "not-allowed" : "pointer",
                        background: "#222",
                        borderRadius: 8,
                        padding: "8px 10px",
                        marginBottom: 4,
                        border: "1px solid transparent",
                        transition: "border-color 0.15s",
                        opacity: assigningInProgress ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) =>
                        !assigningInProgress &&
                        (e.currentTarget.style.borderColor = "#FFDE58")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "transparent")
                      }
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: "#F0F0F0",
                          display: "block",
                        }}
                      >
                        {rider.full_name ?? rider.email ?? "Unknown"}
                      </Text>
                      <Text style={{ fontSize: 11, color: MUTED_TEXT }}>
                        {rider.vehicle_type} &middot; {rider.plate_number}
                      </Text>
                    </button>
                  ))}
                  <Button
                    type="text"
                    size="small"
                    block
                    onClick={() => setAssigning(null)}
                    disabled={assigningInProgress}
                    style={{ color: MUTED_TEXT, marginTop: 4, fontSize: 12 }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  block
                  ghost
                  size="small"
                  icon={<UserAddOutlined />}
                  aria-label={`Assign rider for ${order.order_id}`}
                  onClick={() => setAssigning(order.order_id ?? order.id)}
                  style={{
                    borderColor: "#333",
                    color: "#FFDE58",
                    borderRadius: 8,
                    height: 32,
                    fontSize: 12.5,
                  }}
                >
                  Assign Rider
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
