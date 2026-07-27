import {
  Card,
  Descriptions,
  Typography,
  Button,
  Select,
  App,
  Modal,
  Input,
  Table,
  Space,
  Row,
  Col,
  Timeline,
  Spin,
  Tag,
} from "antd";
import {
  ExclamationCircleOutlined,
  EnvironmentOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { GridGoogleMap } from "@/components/google-map/grid-google-map";
import type { OrderStatus } from "@/types/enums";
import { ORDER_STATUS_LABELS } from "@/types/enums";
import { StatusBadge } from "@/components/status-badge";
import { FilePreviewModal } from "@/components/file-preview-modal";
import { ShowPage } from "@/components/show-page";
import { formatCurrency, formatDateTime, statusLabel } from "@/utils/format";
import type {
  Order,
  OrderDestination,
  OrderItem,
  OrderStatusHistory,
} from "@/types/order";
import { apiClient } from "@/providers/api-client";
import { FileInspectorModal } from "@/components/file-inspector/file-inspector-modal";
import {
  humanizeEnumValue,
  normalizeAdminRiders,
  normalizeOrder,
} from "@/utils/api-normalizers";
import { loadOrderFilePreview, type OrderFilePreview } from "./preview";
import { ManualStatusCard } from "./components/manual-status-card";

const { Text } = Typography;
const { TextArea } = Input;

function hasCoordinates(destination?: OrderDestination | null) {
  return (
    Number.isFinite(destination?.latitude) &&
    Number.isFinite(destination?.longitude)
  );
}

function destinationTitle(destination: OrderDestination, index: number) {
  return (
    destination.label ||
    destination.full_address ||
    destination.address ||
    `Destination ${index + 1}`
  );
}

function destinationAddress(destination: OrderDestination) {
  return destination.full_address || destination.address || "Pinned location";
}

function getMappableDestinations(order: Order): OrderDestination[] {
  const seen = new Set<string>();
  const result: OrderDestination[] = [];
  const add = (destination?: OrderDestination | null) => {
    if (!destination || !hasCoordinates(destination)) return;
    const key =
      destination.id != null
        ? `id:${destination.id}`
        : `${destination.latitude}:${destination.longitude}:${destinationAddress(destination)}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(destination);
  };

  order.destinations?.forEach(add);
  add(order.delivery_address);
  order.items?.forEach((item) => add(item.delivery_address));

  return result.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function OrderDestinationMap({
  destinations,
}: {
  destinations: OrderDestination[];
}) {
  const positions = destinations.map((destination) => ({
    lat: destination.latitude as number,
    lng: destination.longitude as number,
  }));
  const center = positions[0] ?? { lat: 7.0713113, lng: 125.6123279 };

  return (
    <GridGoogleMap
      center={center}
      zoom={15}
      height={320}
      markers={destinations.map((destination, index) => ({
        id: String(
          destination.id ??
            `${destination.latitude}:${destination.longitude}:${index}`,
        ),
        position: positions[index],
        title: `${destinationTitle(destination, index)} · ${destinationAddress(
          destination,
        )}${destination.landmark ? ` · ${destination.landmark}` : ""}`,
      }))}
      fitPositions={positions}
    />
  );
}

function getOrderLineItems(order: Order): OrderItem[] {
  if (order.items && order.items.length > 0) return order.items;

  return [
    {
      id: order.id,
      category: order.category === "3d" ? "3d" : "paper",
      file_name: order.file_name,
      quantity: order.quantity,
      total_price: order.total_price,
      paper_specs: order.paper_specs,
      three_d_specs: order.three_d_specs,
    },
  ];
}

function getOrderTypeLabel(order: Order) {
  const categories = new Set(
    getOrderLineItems(order)
      .map((item) => item.category)
      .filter(
        (category): category is "paper" | "3d" =>
          category === "paper" || category === "3d",
      ),
  );

  if (categories.has("paper") && categories.has("3d")) {
    return "Mixed Printing";
  }

  if (categories.has("3d")) {
    return "3D Printing";
  }

  return "Paper Printing";
}

export function OrderShow() {
  const { id } = useParams<{ id: string }>();
  const { modal, message } = App.useApp();
  const [order, setOrder] = useState<
    (Order & { status_history?: OrderStatusHistory[] }) | null
  >(null);
  const [availableRiders, setAvailableRiders] = useState<
    {
      id: number;
      full_name: string | null;
      vehicle_type: string;
      plate_number: string | null;
      is_available?: boolean;
      assignment_eligible?: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [riderModalOpen, setRiderModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [fileInspectorOpen, setFileInspectorOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<OrderFilePreview | null>(null);
  const [previewingFileId, setPreviewingFileId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient
        .get(`/admin/orders/${id}`)
        .then((r) => setOrder(normalizeOrder(r.data)))
        .catch(() => {}),
      apiClient
        .get("/admin/riders")
        .then((r) =>
          setAvailableRiders(
            normalizeAdminRiders(r.data).filter(
              (rider) => rider.assignment_eligible,
            ),
          ),
        )
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <ShowPage title="Order" backTo="/orders" contentCard={false}>
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      </ShowPage>
    );
  }

  if (!order) {
    return (
      <ShowPage title="Order Not Found" backTo="/orders">
        <Text>Order not found.</Text>
      </ShowPage>
    );
  }

  const history = order.status_history ?? [];
  const items = getOrderLineItems(order);
  const destinations = getMappableDestinations(order);
  const validNextStatuses = order.allowed_next_statuses ?? [];
  const canAssignRider =
    order.order_status === "ready_for_dispatch" &&
    order.delivery_option === "delivery" &&
    !order.assigned_rider_contact?.delivery_assignment_id;
  const assignedRiderName =
    order.assigned_rider_contact?.display_name ??
    order.assigned_rider_contact?.full_name ??
    order.assigned_rider_contact?.nickname;

  const handleStatusChange = (newStatus: OrderStatus) => {
    if (newStatus === "file_declined") {
      setDeclineModalOpen(true);
      return;
    }
    modal.confirm({
      title: "Update Status",
      icon: <ExclamationCircleOutlined />,
      content: `Change status to "${statusLabel(newStatus)}"?`,
      onOk: async () => {
        try {
          await apiClient.patch(`/admin/orders/${id}/status`, {
            status: newStatus,
          });
          void message.success(`Status updated to ${statusLabel(newStatus)}`);
          const res = await apiClient.get(`/admin/orders/${id}`);
          setOrder(normalizeOrder(res.data));
        } catch {
          void message.error("Failed to update status");
        }
      },
    });
  };

  const handleAssignRider = async (riderId: number) => {
    try {
      await apiClient.post(`/admin/orders/${id}/assign`, { riderId });
      void message.success("Rider assigned");
      setRiderModalOpen(false);
      const res = await apiClient.get(`/admin/orders/${id}`);
      setOrder(normalizeOrder(res.data));
    } catch {
      void message.error("Failed to assign rider");
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      void message.error("Please provide a reason");
      return;
    }
    try {
      await apiClient.patch(`/admin/orders/${id}/status`, {
        status: "file_declined",
        notes: declineReason,
      });
      void message.success("Order declined");
      setDeclineModalOpen(false);
      setDeclineReason("");
      const res = await apiClient.get(`/admin/orders/${id}`);
      setOrder(normalizeOrder(res.data));
    } catch {
      void message.error("Failed to decline order");
    }
  };

  const openPreview = async (
    fileUrl: string | null | undefined,
    fileName: string,
    fileMetadataId?: number,
    paperSize?: string,
  ) => {
    const previewKey = `${fileMetadataId ?? "legacy"}:${fileName}`;
    setPreviewingFileId(previewKey);
    try {
      const preview = await loadOrderFilePreview({
        get: apiClient.get.bind(apiClient),
        fileUrl,
        fileName,
        fileMetadataId,
        paperSize,
      });
      setPreviewFile(preview);
    } catch {
      void message.error(
        "Unable to open this file preview. Check that the file still exists in storage.",
      );
    } finally {
      setPreviewingFileId(null);
    }
  };

  const openProofPhoto = async () => {
    const proof = order.delivery_proof;
    if (!proof?.file_id) return;
    setPreviewingFileId(`pod:${proof.file_id}`);
    try {
      const response = await apiClient.get<{ url: string }>(
        `/files/${proof.file_id}/presigned-url`,
      );
      setPreviewFile({
        url: response.data.url,
        name: `proof-of-delivery-${order.order_id}.jpg`,
        mimeType: "image/jpeg",
        inspection: null,
      });
    } catch {
      void message.error("Unable to open proof of delivery photo.");
    } finally {
      setPreviewingFileId(null);
    }
  };

  return (
    <ShowPage
      title={`Order ${order.order_id}`}
      backTo="/orders"
      contentCard={false}
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Header with actions */}
        <Card>
          <Row justify="space-between" align="middle">
            <Col>
              <Space size="middle">
                <StatusBadge status={order.order_status} />
                <Text style={{ textTransform: "capitalize" }}>
                  {items.length > 1
                    ? `${getOrderTypeLabel(order)} · ${items.length} print jobs`
                    : getOrderTypeLabel(order)}
                </Text>
                {assignedRiderName && (
                  <Tag color="green">Assigned rider: {assignedRiderName}</Tag>
                )}
              </Space>
            </Col>
            <Col>
              <Space>
                {validNextStatuses.length > 0 && (
                  <Select
                    placeholder="Update Status"
                    aria-label={`Update status for ${order.order_id}`}
                    style={{ width: 200 }}
                    onChange={handleStatusChange}
                    options={validNextStatuses.map((s) => ({
                      label: ORDER_STATUS_LABELS[s],
                      value: s,
                    }))}
                  />
                )}
                {canAssignRider && (
                  <Button
                    icon={<UserSwitchOutlined />}
                    aria-label={`Assign rider for ${order.order_id}`}
                    onClick={() => setRiderModalOpen(true)}
                  >
                    Assign Rider
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Customer Information */}
        <Card title="Customer Information">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Name">
              {order.customer_name ?? "Unknown"}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {order.customer_email ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Customer ID">
              {order.customer_id ? (
                <Link
                  to={`/users/show/${order.customer_id}`}
                  style={{ fontWeight: 500 }}
                >
                  #{order.customer_id}
                </Link>
              ) : (
                <span style={{ fontFamily: "monospace", color: "#888" }}>
                  {order.user_id?.split("-")[0] ?? "—"}
                </span>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Order Items */}
        <Card
          title="Order Items"
          extra={
            order.file_url && order.file_name ? (
              <Button
                type="primary"
                size="small"
                onClick={() => setFileInspectorOpen(true)}
              >
                Inspect File
              </Button>
            ) : null
          }
        >
          <Table dataSource={items} rowKey="id" pagination={false} size="small">
            <Table.Column
              title="Type"
              render={(_: unknown, item: any) => (
                <Tag color={item.category === "paper" ? "blue" : "purple"}>
                  {item.category === "paper" ? "Paper" : "3D"}
                </Tag>
              )}
            />
            <Table.Column
              title="File"
              dataIndex="file_name"
              render={(v: string | null, item: any) =>
                v && item.file_url ? (
                  <Button
                    type="link"
                    size="small"
                    loading={
                      previewingFileId ===
                      `${item.file_metadata_id ?? "legacy"}:${v}`
                    }
                    style={{ padding: 0 }}
                    onClick={() =>
                      void openPreview(
                        item.file_url,
                        v,
                        item.file_metadata_id,
                        item.paper_specs?.paper_size,
                      )
                    }
                  >
                    {v}
                  </Button>
                ) : (
                  (v ?? "—")
                )
              }
            />
            {destinations.length > 1 && (
              <Table.Column
                title="Destination"
                render={(_: unknown, item: OrderItem) => {
                  const destination = item.delivery_address;
                  return destination
                    ? destinationTitle(destination, 0)
                    : "Unassigned";
                }}
              />
            )}
            <Table.Column title="Qty" dataIndex="quantity" width={80} />
            <Table.Column
              title="Specs"
              render={(_: unknown, item: any) => {
                if (item.paper_specs) {
                  return `${item.paper_specs.paper_size?.toUpperCase()} · ${humanizeEnumValue(item.paper_specs.color_mode)} · ${humanizeEnumValue(item.paper_specs.print_sides)}`;
                }
                if (item.three_d_specs) {
                  return `${item.three_d_specs.file_format?.toUpperCase()} · ${item.three_d_specs.material?.toUpperCase()} · ${item.three_d_specs.infill_percentage}% infill`;
                }
                return "—";
              }}
            />
            <Table.Column
              title="Amount"
              align="right"
              render={(_: unknown, item: any) =>
                formatCurrency(item.total_price ?? 0)
              }
            />
          </Table>
        </Card>

        {/* Price Breakdown */}
        <Card title="Price Breakdown">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Subtotal">
              {formatCurrency(order.total_price)}
            </Descriptions.Item>
            <Descriptions.Item label="Delivery Fee">
              {formatCurrency(order.delivery_fee)}
            </Descriptions.Item>
            <Descriptions.Item label="Total">
              {formatCurrency(order.total_price + order.delivery_fee)}
            </Descriptions.Item>
            <Descriptions.Item label="Payment Method">
              <span style={{ textTransform: "uppercase" }}>
                {order.payment_method}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Payment Status">
              <span style={{ textTransform: "capitalize" }}>
                {order.payment_status}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Delivery">
              {order.delivery_option === "delivery" ? "Delivery" : "Pickup"}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Delivery / Slot Info */}
        {(order.deliverySlotBookingId != null ||
          destinations.length > 0 ||
          (order.priorityFee ?? 0) > 0 ||
          Boolean(order.priority) ||
          Boolean(order.speedTier) ||
          Boolean(order.deliveryType)) && (
          <Card title="Delivery Info">
            <Descriptions column={2} bordered size="small">
              {order.deliverySlotBookingId && (
                <Descriptions.Item label="Slot Booking">
                  <Tag color="cyan">Slot #{order.deliverySlotBookingId}</Tag>
                </Descriptions.Item>
              )}
              {(order.priorityFee ?? 0) > 0 || order.priority ? (
                <Descriptions.Item label="Priority">
                  <Tag color="gold">Priority</Tag>
                </Descriptions.Item>
              ) : null}
              {order.speedTier && (
                <Descriptions.Item label="Speed">
                  {humanizeEnumValue(order.speedTier)}
                </Descriptions.Item>
              )}
              {order.deliveryType && (
                <Descriptions.Item label="Delivery Type">
                  {humanizeEnumValue(order.deliveryType)}
                </Descriptions.Item>
              )}
              {(order.extraDestinationFee ?? 0) > 0 && (
                <Descriptions.Item label="Extra Destination Fee">
                  {formatCurrency(order.extraDestinationFee ?? 0)}
                </Descriptions.Item>
              )}
              {destinations.length > 0 && (
                <Descriptions.Item label="Destinations" span={2}>
                  <Space direction="vertical" size={6}>
                    {destinations.map((destination, index) => (
                      <span key={destination.id ?? index}>
                        <Text strong>
                          {destinationTitle(destination, index)}
                        </Text>
                        {" — "}
                        {destinationAddress(destination)}
                        <Text type="secondary">
                          {" "}
                          ({destination.latitude}, {destination.longitude})
                        </Text>
                      </span>
                    ))}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        {destinations.length > 0 && (
          <Card
            title={
              <Space>
                <EnvironmentOutlined />
                Pinned Delivery Map
              </Space>
            }
          >
            <OrderDestinationMap destinations={destinations} />
          </Card>
        )}

        <Card title="Proof of Delivery">
          {order.delivery_proof ? (
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="Type">
                <Tag
                  color={
                    order.delivery_proof.type === "photo" ? "blue" : "green"
                  }
                >
                  {humanizeEnumValue(order.delivery_proof.type ?? "unknown")}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Captured At">
                {order.delivery_proof.captured_at
                  ? formatDateTime(order.delivery_proof.captured_at)
                  : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Captured By Rider">
                {order.delivery_proof.captured_by_rider_id ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Proof">
                {order.delivery_proof.type === "photo" &&
                order.delivery_proof.file_id ? (
                  <Button
                    size="small"
                    onClick={() => void openProofPhoto()}
                    loading={
                      previewingFileId === `pod:${order.delivery_proof.file_id}`
                    }
                  >
                    View photo proof
                  </Button>
                ) : order.delivery_proof.type === "signature" ? (
                  <Text>Signature captured</Text>
                ) : (
                  "—"
                )}
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <Text type="secondary">
              No proof has been captured for this order.
            </Text>
          )}
        </Card>

        {/* Admin Notes */}
        <Card title="Admin Notes">
          <TextArea
            rows={3}
            defaultValue={order.admin_notes ?? ""}
            placeholder="Internal notes (not visible to customer)..."
            onBlur={async (e) => {
              const newNotes = e.target.value;
              if (newNotes !== (order.admin_notes ?? "")) {
                try {
                  await apiClient.patch(`/admin/orders/${id}/notes`, {
                    adminNotes: newNotes,
                  });
                  void message.success("Notes saved");
                  setOrder({ ...order, admin_notes: newNotes });
                } catch {
                  void message.error("Failed to save notes");
                }
              }
            }}
          />
        </Card>

        <ManualStatusCard
          orderId={order.id}
          initialNote={order.adminStatusNote ?? null}
          initialCompletionAt={order.estimatedCompletionAt ?? null}
          onUpdated={async () => {
            const res = await apiClient.get(`/admin/orders/${id}`);
            setOrder(normalizeOrder(res.data));
          }}
        />

        {/* Status History */}
        <Card title="Status History">
          {history.length === 0 ? (
            <Text type="secondary">No status changes recorded yet.</Text>
          ) : (
            <Timeline
              items={history.map((h) => ({
                children: (
                  <div>
                    <Text strong>
                      {statusLabel(h.from_status as OrderStatus)}
                    </Text>
                    {" → "}
                    <Text strong>
                      {statusLabel(h.to_status as OrderStatus)}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {formatDateTime(h.created_at)}
                      {h.changed_by_user_id
                        ? ` · Actor #${h.changed_by_user_id}`
                        : " · System"}
                      {h.notes && ` — ${h.notes}`}
                    </Text>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      </Space>

      {/* Rider Assignment Modal */}
      <Modal
        title="Assign Rider"
        open={riderModalOpen}
        onCancel={() => setRiderModalOpen(false)}
        footer={null}
      >
        <Table
          dataSource={availableRiders}
          rowKey="id"
          pagination={false}
          size="small"
        >
          <Table.Column dataIndex="full_name" title="Name" />
          <Table.Column
            dataIndex="vehicle_type"
            title="Vehicle"
            render={(v: string) => humanizeEnumValue(v, "Unknown")}
          />
          <Table.Column dataIndex="plate_number" title="Plate" />
          <Table.Column
            title=""
            render={(
              _: unknown,
              record: {
                id: number;
                full_name: string;
                vehicle_type: string;
                plate_number: string | null;
              },
            ) => (
              <Button
                type="primary"
                size="small"
                onClick={() => handleAssignRider(record.id)}
              >
                Assign
              </Button>
            )}
          />
        </Table>
      </Modal>

      {/* Decline Modal */}
      <Modal
        title="Decline Order"
        open={declineModalOpen}
        onOk={handleDecline}
        onCancel={() => {
          setDeclineModalOpen(false);
          setDeclineReason("");
        }}
        okText="Decline Order"
        okButtonProps={{ danger: true }}
      >
        <p>
          Provide a reason for declining this order. The customer will be
          notified.
        </p>
        <TextArea
          rows={3}
          value={declineReason}
          onChange={(e) => setDeclineReason(e.target.value)}
          placeholder="Reason for declining..."
        />
      </Modal>

      {/* File Inspector Modal (top-level order file) */}
      {order.file_url && order.file_name && (
        <FileInspectorModal
          open={fileInspectorOpen}
          onClose={() => setFileInspectorOpen(false)}
          onVerify={async () => {
            try {
              await apiClient.patch(`/admin/orders/${id}/status`, {
                status: "file_verified",
              });
              void message.success("File verified successfully");
              setFileInspectorOpen(false);
              const res = await apiClient.get(`/admin/orders/${id}`);
              setOrder(normalizeOrder(res.data));
            } catch {
              void message.error("Failed to verify file");
            }
          }}
          fileUrl={order.file_url}
          fileName={order.file_name}
          fileMetadataId={order.file_metadata_id ?? undefined}
        />
      )}

      {/* Per-item File Preview Modal */}
      <FilePreviewModal
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        fileName={previewFile?.name ?? ""}
        fileUrl={previewFile?.url ?? ""}
        mimeType={previewFile?.mimeType ?? ""}
        inspection={previewFile?.inspection}
      />
    </ShowPage>
  );
}
