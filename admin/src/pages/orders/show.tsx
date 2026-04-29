import { Show } from "@refinedev/antd";
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
  UserSwitchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useParams } from "react-router";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import type { OrderStatus } from "@/types/enums";
import { ORDER_STATUS_TRANSITIONS, ORDER_STATUS_LABELS } from "@/types/enums";
import { StatusBadge } from "@/components/status-badge";
import { FilePreviewModal, type FileInspection } from "@/components/file-preview-modal";
import { formatCurrency, formatDateTime, statusLabel } from "@/utils/format";
import type { Order, OrderItem, OrderStatusHistory } from "@/types/order";
import { apiClient } from "@/providers/api-client";
import {
  humanizeEnumValue,
  normalizeAdminDrivers,
  normalizeOrder,
} from "@/utils/api-normalizers";

const { Text } = Typography;
const { TextArea } = Input;

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
  const [availableDrivers, setAvailableDrivers] = useState<
    {
      id: number;
      full_name: string | null;
      vehicle_type: string;
      plate_number: string | null;
      is_available?: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [driverModalOpen, setDriverModalOpen] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [previewFile, setPreviewFile] = useState<{
    url: string; name: string; mimeType: string; inspection: FileInspection | null;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient
        .get(`/admin/orders/${id}`)
        .then((r) => setOrder(normalizeOrder(r.data)))
        .catch(() => {}),
      apiClient
        .get("/admin/drivers")
        .then((r) => setAvailableDrivers(normalizeAdminDrivers(r.data)))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Show title="Order">
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      </Show>
    );
  }

  if (!order) {
    return (
      <Show title="Order Not Found">
        <Text>Order not found.</Text>
      </Show>
    );
  }

  const history = order.status_history ?? [];
  const items = getOrderLineItems(order);
  const validNextStatuses = ORDER_STATUS_TRANSITIONS[order.order_status];
  const canAssignDriver =
    order.order_status === "ready_for_dispatch" ||
    order.order_status === "driver_assigned";

  const handleStatusChange = (newStatus: OrderStatus) => {
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

  const handleAssignDriver = async (driverId: number) => {
    try {
      await apiClient.post(`/admin/orders/${id}/assign`, { driverId });
      void message.success("Driver assigned");
      setDriverModalOpen(false);
      const res = await apiClient.get(`/admin/orders/${id}`);
      setOrder(normalizeOrder(res.data));
    } catch {
      void message.error("Failed to assign driver");
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

  const openPreview = async (fileUrl: string, fileName: string, mimeType: string, fileMetadataId?: number, paperSize?: string) => {
    let inspection = null;
    if (fileMetadataId) {
      try {
        const params = paperSize ? `?paperSize=${paperSize}` : '';
        const res = await apiClient.get(`/files/${fileMetadataId}/inspect${params}`);
        inspection = res.data;
      } catch { /* inspection is non-critical */ }
    }
    setPreviewFile({ url: fileUrl, name: fileName, mimeType, inspection });
  };

  return (
    <Show title={`Order ${order.order_id}`}>
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
              </Space>
            </Col>
            <Col>
              <Space>
                {validNextStatuses.length > 0 && (
                  <Select
                    placeholder="Update Status"
                    style={{ width: 200 }}
                    onChange={handleStatusChange}
                    options={validNextStatuses.map((s) => ({
                      label: ORDER_STATUS_LABELS[s],
                      value: s,
                    }))}
                  />
                )}
                {canAssignDriver && (
                  <Button
                    icon={<UserSwitchOutlined />}
                    onClick={() => setDriverModalOpen(true)}
                  >
                    Assign Driver
                  </Button>
                )}
                {order.order_status !== "cancelled" &&
                  order.order_status !== "delivered" &&
                  order.order_status !== "file_declined" && (
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={() => setDeclineModalOpen(true)}
                    >
                      Decline
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
        <Card title="Order Items">
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
                    style={{ padding: 0 }}
                    onClick={() => {
                      const ext = v.split('.').pop()?.toLowerCase() ?? '';
                      const mimeType = ext === 'pdf' ? 'application/pdf'
                        : ['jpg', 'jpeg'].includes(ext) ? 'image/jpeg'
                        : ext === 'png' ? 'image/png'
                        : 'application/octet-stream';
                      void openPreview(item.file_url, v, mimeType, item.file_metadata_id, item.paper_specs?.paper_size);
                    }}
                  >
                    {v}
                  </Button>
                ) : (v ?? "—")
              }
            />
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
                      {h.notes && ` — ${h.notes}`}
                    </Text>
                  </div>
                ),
              }))}
            />
          )}
        </Card>
      </Space>

      {/* Driver Assignment Modal */}
      <Modal
        title="Assign Driver"
        open={driverModalOpen}
        onCancel={() => setDriverModalOpen(false)}
        footer={null}
      >
        <Table
          dataSource={availableDrivers}
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
                onClick={() => handleAssignDriver(record.id)}
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

      <FilePreviewModal
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        fileName={previewFile?.name ?? ''}
        fileUrl={previewFile?.url ?? ''}
        mimeType={previewFile?.mimeType ?? ''}
        inspection={previewFile?.inspection}
      />
    </Show>
  );
}
