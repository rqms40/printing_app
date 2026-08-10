import {
  Alert,
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
  DollarOutlined,
  ExclamationCircleOutlined,
  EnvironmentOutlined,
  ShopOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { DivIcon, LatLngBounds, type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
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
import { OrderPrice } from "./components/order-price";
import { OrderProductLabel, productDisplayName } from "./components/order-product-label";
import { OrderSpecifications } from "./components/order-specifications";
import {
  adminOrderProgressPipeline,
  isPickupDeliveryOption,
  progressStepState,
} from "@/utils/order-progress-pipeline";

const { Text } = Typography;
const { TextArea } = Input;

const DESTINATION_PIN_ICON = new DivIcon({
  className: "order-destination-pin",
  html: `<div style="width:18px;height:18px;border-radius:50%;background:#1677ff;border:3px solid #fff;box-shadow:0 2px 12px rgba(0,0,0,.35);"></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function toCoordinate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function withPinnedCoordinates(
  destination: OrderDestination,
): OrderDestination | null {
  const latitude = toCoordinate(destination.latitude);
  const longitude = toCoordinate(destination.longitude);
  if (latitude == null || longitude == null) return null;
  return { ...destination, latitude, longitude };
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

/** Canonical delivery pins shared by Delivery Info and Pinned Delivery Map. */
function getMappableDestinations(order: Order): OrderDestination[] {
  const seen = new Set<string>();
  const result: OrderDestination[] = [];
  const add = (destination?: OrderDestination | null) => {
    if (!destination) return;
    const pinned = withPinnedCoordinates(destination);
    if (!pinned) return;
    const key =
      pinned.id != null
        ? `id:${pinned.id}`
        : `${pinned.latitude}:${pinned.longitude}:${destinationAddress(pinned)}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(pinned);
  };

  // Prefer server-built destinations[], then order-level, then item drops.
  order.destinations?.forEach(add);
  add(order.delivery_address);
  order.items?.forEach((item) => add(item.delivery_address));

  return result.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

function destinationMapKey(destinations: OrderDestination[]): string {
  return destinations
    .map(
      (d) =>
        `${d.id ?? "x"}:${d.latitude}:${d.longitude}:${destinationAddress(d)}`,
    )
    .join("|");
}

function DestinationMapViewport({
  positionsKey,
  positions,
}: {
  positionsKey: string;
  positions: LatLngExpression[];
}) {
  const map = useMap();

  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
      return;
    }
    map.fitBounds(new LatLngBounds(positions), { padding: [32, 32] });
  }, [map, positions, positionsKey]);

  return null;
}

function OrderDestinationMap({
  destinations,
}: {
  destinations: OrderDestination[];
}) {
  const positions = destinations.map(
    (destination) =>
      [destination.latitude as number, destination.longitude as number] as [
        number,
        number,
      ],
  );
  const center = positions[0] ?? ([7.064, 125.6079] as [number, number]);
  const mapKey = destinationMapKey(destinations);

  return (
    <div style={{ height: 320, borderRadius: 8, overflow: "hidden" }}>
      <MapContainer
        key={mapKey}
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        <DestinationMapViewport positionsKey={mapKey} positions={positions} />
        {destinations.map((destination, index) => (
          <Marker
            key={
              destination.id ??
              `${destination.latitude}:${destination.longitude}:${index}`
            }
            position={positions[index]}
            icon={DESTINATION_PIN_ICON}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{destinationTitle(destination, index)}</strong>
                <div>{destinationAddress(destination)}</div>
                {destination.landmark && (
                  <div>Landmark: {destination.landmark}</div>
                )}
                <div style={{ color: "#666", fontSize: 12 }}>
                  {destination.latitude}, {destination.longitude}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

function getOrderLineItems(order: Order): OrderItem[] {
  if (order.items && order.items.length > 0) return order.items;

  return [
    {
      id: order.id,
      category: order.category === "batch" ? "paper" : order.category,
      file_name: order.file_name,
      quantity: order.quantity,
      total_price: order.total_price,
      paper_specs: order.paper_specs,
      three_d_specs: order.three_d_specs,
    },
  ];
}

function getOrderTypeLabel(order: Order) {
  const lineItems = getOrderLineItems(order);
  if (lineItems.some((item) => item.category_name || !['paper', '3d'].includes(item.category))) {
    const labels = lineItems.slice(0, 2).map(productDisplayName);
    return lineItems.length > 2 ? `${labels.join(' + ')} +${lineItems.length - 2}` : labels.join(' + ');
  }
  const categories = new Set(
    lineItems
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
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [verifiedSuppliers, setVerifiedSuppliers] = useState<
    {
      supplierId: number;
      businessName: string;
      isEligibleCandidate: boolean;
      score: number | null;
      rankPosition: number | null;
      excludeReason: string | null;
      capabilities: string[];
      serviceZones: string[];
    }[]
  >([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [assigningSupplierId, setAssigningSupplierId] = useState<number | null>(
    null,
  );
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
  const canAssignSupplier = order.order_status === "approved_for_matching";
  const canAuthorizePayment =
    order.order_status === "supplier_accepted" ||
    order.order_status === "awaiting_payment";
  const assignedRiderName =
    order.assigned_rider_contact?.display_name ??
    order.assigned_rider_contact?.full_name ??
    order.assigned_rider_contact?.nickname;
  const assignedSupplierName =
    order.assigned_supplier_contact?.business_name ?? null;
  const assignedSupplierDecision =
    order.assigned_supplier_contact?.decision ?? null;

  const handleStatusChange = (newStatus: OrderStatus) => {
    if (newStatus === "file_rejected") {
      setDeclineModalOpen(true);
      return;
    }
    if (newStatus === "rider_assigned" && !order.assigned_rider_contact?.delivery_assignment_id) {
      setRiderModalOpen(true);
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
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? "Failed to assign rider";
      void message.error(Array.isArray(msg) ? msg.join(", ") : String(msg));
    }
  };

  const handleAuthorizePayment = () => {
    modal.confirm({
      title: "Authorize payment",
      icon: <DollarOutlined />,
      content:
        "Authorize Pilot Credits or eligible COD for this order? Production can start after authorization. Credits (if any) are charged to the customer.",
      okText: "Authorize payment",
      onOk: async () => {
        try {
          await apiClient.post(`/orders/${id}/authorize-payment`);
          void message.success("Payment authorized — production can start");
          const res = await apiClient.get(`/admin/orders/${id}`);
          setOrder(normalizeOrder(res.data));
        } catch (e: unknown) {
          const msg =
            (e as { response?: { data?: { message?: string | string[] } } })
              ?.response?.data?.message ?? "Failed to authorize payment";
          void message.error(
            Array.isArray(msg) ? msg.join(", ") : String(msg),
          );
          throw e;
        }
      },
    });
  };

  const openSupplierAssign = async () => {
    setSupplierModalOpen(true);
    setSuppliersLoading(true);
    try {
      const res = await apiClient.get(`/ops/matching/${id}/candidates`);
      const list = Array.isArray(res.data?.verifiedSuppliers)
        ? res.data.verifiedSuppliers
        : Array.isArray(res.data?.candidates)
          ? res.data.candidates.map(
              (c: {
                supplierId: number;
                businessName: string;
                score?: number;
                rankPosition?: number;
              }) => ({
                supplierId: c.supplierId,
                businessName: c.businessName,
                isEligibleCandidate: true,
                score: c.score ?? null,
                rankPosition: c.rankPosition ?? null,
                excludeReason: null,
                capabilities: [],
                serviceZones: [],
              }),
            )
          : [];
      setVerifiedSuppliers(list);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Could not load verified suppliers";
      void message.error(typeof msg === "string" ? msg : "Load failed");
      setVerifiedSuppliers([]);
    } finally {
      setSuppliersLoading(false);
    }
  };

  const handleAssignSupplier = async (supplierId: number) => {
    setAssigningSupplierId(supplierId);
    try {
      await apiClient.post(`/ops/matching/${id}/assign`, { supplierId });
      void message.success("Supplier assigned");
      setSupplierModalOpen(false);
      const res = await apiClient.get(`/admin/orders/${id}`);
      setOrder(normalizeOrder(res.data));
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to assign supplier";
      void message.error(typeof msg === "string" ? msg : "Assign failed");
    } finally {
      setAssigningSupplierId(null);
    }
  };

  const handleAutoMatchSupplier = async () => {
    setAssigningSupplierId(-1);
    try {
      await apiClient.post(`/ops/matching/${id}/auto-match`);
      void message.success("Top-ranked supplier auto-matched");
      setSupplierModalOpen(false);
      const res = await apiClient.get(`/admin/orders/${id}`);
      setOrder(normalizeOrder(res.data));
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Auto-match failed";
      void message.error(typeof msg === "string" ? msg : "Auto-match failed");
    } finally {
      setAssigningSupplierId(null);
    }
  };

  const handleDecline = async () => {
    if (!declineReason.trim()) {
      void message.error("Please provide a reason");
      return;
    }
    try {
      await apiClient.patch(`/admin/orders/${id}/status`, {
        status: "file_rejected",
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

  const openSelfQcEvidence = async (fileId: number, index: number) => {
    setPreviewingFileId(`selfqc:${fileId}`);
    try {
      const response = await apiClient.get<{ url: string }>(
        `/files/${fileId}/presigned-url`,
      );
      setPreviewFile({
        url: response.data.url,
        name: `self-qc-evidence-${order.order_id}-${index + 1}.jpg`,
        mimeType: "image/jpeg",
        inspection: null,
      });
    } catch {
      void message.error("Unable to open proof of fulfillment photo.");
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
                {assignedSupplierName && (
                  <Tag color="purple">
                    Supplier: {assignedSupplierName}
                    {assignedSupplierDecision
                      ? ` (${assignedSupplierDecision})`
                      : ""}
                  </Tag>
                )}
                {assignedRiderName && (
                  <Tag color="green">Assigned rider: {assignedRiderName}</Tag>
                )}
                {order.assigned_rider_contact?.pickup_otp ? (
                  <Tag color="volcano">
                    Pickup OTP: {order.assigned_rider_contact.pickup_otp}
                  </Tag>
                ) : null}
                {order.assigned_rider_contact?.delivery_otp ? (
                  <Tag color="orange">
                    Delivery OTP: {order.assigned_rider_contact.delivery_otp}
                  </Tag>
                ) : null}
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
                      label: s === "rider_assigned" && !order.assigned_rider_contact?.delivery_assignment_id 
                        ? "Assign a Rider" 
                        : ORDER_STATUS_LABELS[s],
                      value: s,
                    }))}
                  />
                )}
                {canAuthorizePayment && (
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    aria-label={`Authorize payment for ${order.order_id}`}
                    onClick={handleAuthorizePayment}
                  >
                    Authorize Payment
                  </Button>
                )}
                {canAssignSupplier && (
                  <Button
                    type="primary"
                    icon={<ShopOutlined />}
                    aria-label={`Assign supplier for ${order.order_id}`}
                    onClick={() => void openSupplierAssign()}
                  >
                    Assign Supplier
                  </Button>
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
        {order.unmet_coverage ? (
          <Alert type="warning" showIcon message="Unmet supplier coverage" description={order.matching_outcome?.message ?? "No verified active supplier currently covers this leaf product."} />
        ) : null}
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
              render={(_: unknown, item: OrderItem) => <OrderProductLabel item={item} />}
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
              render={(_: unknown, item: OrderItem) => <OrderSpecifications item={item} />}
            />
            <Table.Column
              title="Amount"
              align="right"
              render={(_: unknown, item: OrderItem) => <OrderPrice pricingStatus={order.pricing_status} legacyAmount={item.total_price} />}
            />
          </Table>
        </Card>

        {/* Price Breakdown */}
        <Card title="Price Breakdown">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Goods quote">
              <OrderPrice
                pricingStatus={order.pricing_status}
                minor={order.current_supplier_assignment?.final_price_minor}
                legacyAmount={order.total_price}
              />
            </Descriptions.Item>
            <Descriptions.Item label="Delivery Fee">
              {order.pricing_status === "pending_quote" || order.delivery_fee == null
                ? "Pending quote"
                : formatCurrency(order.delivery_fee)}
            </Descriptions.Item>
            <Descriptions.Item label="Quoted total">
              <OrderPrice pricingStatus={order.pricing_status} minor={order.quoted_total_minor} legacyAmount={order.total_price == null || order.delivery_fee == null ? null : order.total_price + order.delivery_fee} />
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

        {order.assigned_supplier_contact?.self_qc_evidence_file_ids && order.assigned_supplier_contact.self_qc_evidence_file_ids.length > 0 && (
          <Card title="Proof of Fulfillment">
            <Space size="middle" wrap>
              {order.assigned_supplier_contact.self_qc_evidence_file_ids.map((fileId, idx) => (
                <Button
                  key={fileId}
                  onClick={() => void openSelfQcEvidence(fileId, idx)}
                  loading={previewingFileId === `selfqc:${fileId}`}
                >
                  View evidence photo {idx + 1}
                </Button>
              ))}
            </Space>
          </Card>
        )}

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

        {/* Marketplace + logistics progress (always shows steps after Ready for Dispatch) */}
        <Card
          title="Order progress"
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Delivery process after Ready for Dispatch: assign rider → pick up
              → out for delivery → delivered
            </Text>
          }
        >
          {(() => {
            const isPickup = isPickupDeliveryOption(order.delivery_option);
            const historyStatuses = history.flatMap((h) => [
              h.from_status as OrderStatus,
              h.to_status as OrderStatus,
            ]);
            const pipeline = adminOrderProgressPipeline({
              isPickup,
              includeOptional: historyStatuses,
            });
            const current = order.order_status as OrderStatus;
            return (
              <Timeline
                items={pipeline.map((step) => {
                  const state = progressStepState(step, current, pipeline);
                  const color =
                    state === "done"
                      ? "green"
                      : state === "current"
                        ? "blue"
                        : "gray";
                  const isLogistics =
                    step === "rider_assigned" ||
                    step === "picked_up" ||
                    step === "out_for_delivery" ||
                    step === "delivered";
                  return {
                    color,
                    children: (
                      <div>
                        <Text
                          strong={state === "current"}
                          type={state === "todo" ? "secondary" : undefined}
                        >
                          {ORDER_STATUS_LABELS[step] ?? statusLabel(step)}
                          {isLogistics ? " · Delivery process" : ""}
                          {step === "ready_for_dispatch" &&
                          current === "ready_for_dispatch"
                            ? " · Assign rider next"
                            : ""}
                        </Text>
                      </div>
                    ),
                  };
                })}
              />
            );
          })()}
        </Card>

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

      {/* Supplier Assignment Modal */}
      <Modal
        title="Assign verified supplier"
        open={supplierModalOpen}
        onCancel={() => setSupplierModalOpen(false)}
        footer={null}
        width={720}
      >
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Text type="secondary">
            Showing verified active suppliers. Ranked-eligible shops appear
            first; you can still assign any verified supplier (ops override).
          </Text>
          <Button
            onClick={() => void handleAutoMatchSupplier()}
            loading={assigningSupplierId === -1}
            disabled={suppliersLoading}
          >
            Auto-match top ranked
          </Button>
          <Table
            loading={suppliersLoading}
            dataSource={verifiedSuppliers}
            rowKey="supplierId"
            pagination={{ pageSize: 8 }}
            size="small"
            locale={{ emptyText: "No verified suppliers available" }}
            columns={[
              {
                title: "Shop",
                dataIndex: "businessName",
                render: (name: string, row) => (
                  <Space direction="vertical" size={0}>
                    <Text strong>{name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      #{row.supplierId}
                      {row.capabilities?.length
                        ? ` · ${row.capabilities.join(", ")}`
                        : ""}
                    </Text>
                  </Space>
                ),
              },
              {
                title: "Match",
                width: 140,
                render: (_, row) =>
                  row.isEligibleCandidate ? (
                    <Tag color="green">
                      Ranked
                      {row.rankPosition != null ? ` #${row.rankPosition}` : ""}
                      {row.score != null ? ` · ${row.score.toFixed(2)}` : ""}
                    </Tag>
                  ) : (
                    <Tag color="default">
                      {row.excludeReason
                        ? humanizeEnumValue(row.excludeReason)
                        : "Override OK"}
                    </Tag>
                  ),
              },
              {
                title: "",
                width: 100,
                render: (_, row) => (
                  <Button
                    type="primary"
                    size="small"
                    loading={assigningSupplierId === row.supplierId}
                    onClick={() => void handleAssignSupplier(row.supplierId)}
                  >
                    Assign
                  </Button>
                ),
              },
            ]}
          />
        </Space>
      </Modal>

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
                status: "approved_for_matching",
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
