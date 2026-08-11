import { List } from "@refinedev/antd";
import {
  Table,
  Input,
  Radio,
  Space,
  Badge,
  Tag,
  Tooltip,
  Select,
  Button,
  App,
  Alert,
  Modal,
} from "antd";
import {
  SearchOutlined,
  EyeOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Order, OrderItem } from "@/types/order";
import type { OrderStatus, PaymentStatus } from "@/types/enums";
import { ORDER_STATUS_LABELS } from "@/types/enums";
import { StatusBadge } from "@/components/status-badge";
import {
  formatRelativeTime,
  formatDate,
  statusLabel,
} from "@/utils/format";
import { apiClient } from "@/providers/api-client";
import {
  humanizeEnumValue,
  normalizeOrders,
  normalizeOrder,
} from "@/utils/api-normalizers";
import { subscribeToOrderUpdates } from "@/providers/live-provider";
import { OrderPrice } from "./components/order-price";
import { OrderProductLabel, productDisplayName } from "./components/order-product-label";

type TabFilter = "new" | "production" | "done" | "all";
type OrderTypeMeta = {
  label: "Paper" | "3D" | "Mixed";
  color: string;
};

const TAB_STATUSES: Record<TabFilter, OrderStatus[] | null> = {
  new: [
    "submitted",
    "needs_qa",
    "client_correction",
    "proof_approval",
    "approved_for_matching",
    "supplier_assigned",
    "supplier_accepted",
    "awaiting_payment",
  ],
  production: [
    "payment_authorized",
    "production",
    "supplier_self_qc",
    "ready_for_dispatch",
    "rider_assigned",
    "picked_up",
    "out_for_delivery",
  ],
  done: [
    "delivered",
    "delivery_failed",
    "collected_by_customer",
    "issue_window_open",
    "completed",
  ],
  all: null,
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  paid: "green",
  pending: "orange",
  failed: "red",
  refunded: "blue",
};

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

function getOrderTypeMeta(order: Order): OrderTypeMeta {
  const categories = new Set(
    getOrderLineItems(order)
      .map((item) => item.category)
      .filter(
        (category): category is "paper" | "3d" =>
          category === "paper" || category === "3d",
      ),
  );

  if (categories.has("paper") && categories.has("3d")) {
    return { label: "Mixed", color: "magenta" };
  }

  if (categories.has("3d")) {
    return { label: "3D", color: "purple" };
  }

  return { label: "Paper", color: "blue" };
}

function getOrderCategoryLabel(order: Order) {
  const type = getOrderTypeMeta(order);
  const itemCount = getOrderLineItems(order).length;
  return itemCount > 1 ? `${type.label} (${itemCount} items)` : type.label;
}

function exportDeliveredCSV(orders: Order[]) {
  const delivered = orders.filter(
    (o) =>
      o.order_status === "delivered" || o.order_status === "collected_by_customer",
  );
  const headers = [
    "Order ID",
    "User ID",
    "Category",
    "Status",
    "Amount",
    "Delivery Fee",
    "Total",
    "Payment Method",
    "Payment Status",
    "Delivery Option",
    "Date",
  ];
  const rows = delivered.map((o) => [
    o.order_id,
    o.user_id,
    getOrderCategoryLabel(o),
    ORDER_STATUS_LABELS[o.order_status] ?? o.order_status,
    o.total_price ?? "",
    o.delivery_fee ?? "",
    o.total_price == null || o.delivery_fee == null ? "" : o.total_price + o.delivery_fee,
    o.payment_method,
    o.payment_status,
    o.delivery_option,
    new Date(o.created_at).toLocaleDateString("en-PH"),
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `delivered-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OrderList() {
  const { modal, message } = App.useApp();
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [declineTarget, setDeclineTarget] = useState<Order | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    setError(null);

    void apiClient
      .get("/admin/orders")
      .then((res) => {
        setOrders(normalizeOrders(res.data));
      })
      .catch((cause: unknown) => {
        setOrders([]);
        setError(cause instanceof Error ? cause.message : "Unable to load orders");
      })
      .finally(() => setLoading(false));
  }, [reloadKey]);

  useEffect(() => {
    return subscribeToOrderUpdates((incoming) => {
      const updated = normalizeOrders([incoming])[0];
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === updated.id);
        if (idx === -1) return [updated, ...prev];
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
    });
  }, []);

  const replaceOrder = (updated: Order) => {
    setOrders((prev) => {
      const idx = prev.findIndex((order) => order.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  };

  const handleStatusChange = (order: Order, newStatus: OrderStatus) => {
    if (newStatus === "file_rejected") {
      setDeclineTarget(order);
      setDeclineReason("");
      return;
    }
    modal.confirm({
      title: "Update Status",
      icon: <ExclamationCircleOutlined />,
      content: `Change status to "${statusLabel(newStatus)}"?`,
      onOk: async () => {
        try {
          await apiClient.patch(`/admin/orders/${order.id}/status`, {
            status: newStatus,
          });
          void message.success(`Status updated to ${statusLabel(newStatus)}`);
          const res = await apiClient.get(`/admin/orders/${order.id}`);
          replaceOrder(normalizeOrder(res.data));
        } catch {
          void message.error("Failed to update status");
        }
      },
    });
  };

  const declineOrder = async () => {
    if (!declineTarget || !declineReason.trim()) return;
    try {
      await apiClient.patch(`/admin/orders/${declineTarget.id}/status`, {
        status: "file_rejected",
        notes: declineReason.trim(),
      });
      const response = await apiClient.get(`/admin/orders/${declineTarget.id}`);
      replaceOrder(normalizeOrder(response.data));
      setDeclineTarget(null);
      setDeclineReason("");
      void message.success("File declined");
    } catch {
      void message.error("Failed to decline file");
    }
  };

  let filtered = orders;
  const tabStatuses = TAB_STATUSES[activeTab];
  if (tabStatuses) {
    filtered = filtered.filter((o) => tabStatuses.includes(o.order_status));
  }
  if (statusFilter !== "all") {
    filtered = filtered.filter((o) => o.order_status === statusFilter);
  }
  if (search) {
    filtered = filtered.filter(
      (o) =>
        o.order_id.toLowerCase().includes(search.toLowerCase()) ||
        o.user_id.toLowerCase().includes(search.toLowerCase()) ||
        (o.customer_name &&
          o.customer_name.toLowerCase().includes(search.toLowerCase())),
    );
  }

  const counts = {
    new: orders.filter((o) => TAB_STATUSES.new!.includes(o.order_status))
      .length,
    production: orders.filter((o) =>
      TAB_STATUSES.production!.includes(o.order_status),
    ).length,
    done: orders.filter((o) => TAB_STATUSES.done!.includes(o.order_status))
      .length,
    all: orders.length,
  };

  return (
    <List title="Orders">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={
              <Button type="link" onClick={() => setReloadKey((value) => value + 1)}>
                Retry
              </Button>
            }
          />
        ) : null}

        <Space
          wrap
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <Radio.Group
            value={activeTab}
            onChange={(e) => {
              setActiveTab(e.target.value as TabFilter);
              setStatusFilter("all");
            }}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="new">
              New{" "}
              <Badge
                count={counts.new}
                style={{ marginLeft: 6 }}
                size="small"
              />
            </Radio.Button>
            <Radio.Button value="production">
              Production{" "}
              <Badge
                count={counts.production}
                style={{ marginLeft: 6 }}
                size="small"
              />
            </Radio.Button>
            <Radio.Button value="done">
              Done{" "}
              <Badge
                count={counts.done}
                style={{ marginLeft: 6 }}
                size="small"
              />
            </Radio.Button>
            <Radio.Button value="all">
              All{" "}
              <Badge
                count={counts.all}
                style={{ marginLeft: 6 }}
                size="small"
                showZero
              />
            </Radio.Button>
          </Radio.Group>

          <Space wrap>
            <Select<OrderStatus | "all">
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              style={{ width: 200 }}
              options={[
                { value: "all", label: "All Statuses" },
                ...Object.entries(ORDER_STATUS_LABELS).map(
                  ([value, label]) => ({ value: value as OrderStatus, label }),
                ),
              ]}
            />
            <Input
              placeholder="Search by Order ID, User ID, or Name..."
              prefix={<SearchOutlined style={{ color: "#555" }} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: 280 }}
            />
            {(statusFilter === "all" || statusFilter === "delivered") && (
              <Button
                icon={<DownloadOutlined />}
                onClick={() => exportDeliveredCSV(orders)}
              >
                Export Delivered CSV
              </Button>
            )}
          </Space>
        </Space>

        <Table
          dataSource={filtered}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 1000 }}
          onRow={(record) => ({
            onClick: () => navigate(`/orders/show/${record.id}`),
            style: { cursor: "pointer" },
          })}
          pagination={{
            pageSize: 20,
            showSizeChanger: false,
            showTotal: (total) => (
              <span style={{ color: "#808080" }}>{total} orders</span>
            ),
          }}
        >
          <Table.Column
            dataIndex="order_id"
            title="Order ID"
            width={130}
            render={(v: string) => (
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>
                {v}
              </span>
            )}
          />
          <Table.Column
            title="Customer"
            width={140}
            render={(_v: unknown, record: Order) => (
              <Tooltip
                title={record.customer_email ?? `User ID: ${record.user_id}`}
              >
                <Space direction="vertical" size={0}>
                  <span style={{ fontWeight: 500, color: "#e6e6e6" }}>
                    {record.customer_name ?? "Unknown"}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "#888",
                    }}
                  >
                    #
                    {record.customer_id ?? record.user_id?.split("-")[0] ?? "—"}
                  </span>
                </Space>
              </Tooltip>
            )}
          />
          <Table.Column
            dataIndex="category"
            title="Type"
            width={110}
            render={(_v: string, record: Order) => {
              const items = getOrderLineItems(record);
              return <OrderProductLabel item={items[0]} />;
            }}
          />
          <Table.Column
            title="Items"
            width={220}
            render={(_v: unknown, record: Order) => {
              const items = getOrderLineItems(record);
              return (
                <Space direction="vertical" size={0}>
                  <span style={{ color: "#888", fontSize: 11 }}>
                    {items.length} {items.length === 1 ? "item" : "items"}
                  </span>
                  <span style={{ color: "#e6e6e6" }}>
                    {items
                      .slice(0, 2)
                      .map(
                        (item) =>
                          productDisplayName(item),
                      )
                      .join(" + ")}
                  </span>
                  {items.length > 2 && (
                    <span style={{ color: "#888", fontSize: 11 }}>
                      +{items.length - 2} more
                    </span>
                  )}
                  {record.unmet_coverage ? (
                    <Tag color="error">Unmet supplier coverage</Tag>
                  ) : null}
                </Space>
              );
            }}
          />
          <Table.Column
            dataIndex="order_status"
            title="Status"
            width={160}
            render={(status: OrderStatus) => <StatusBadge status={status} />}
          />
          <Table.Column
            dataIndex="total_price"
            title="Amount"
            width={110}
            align="right"
            render={(_v: number | null, record: Order) => (
              <OrderPrice pricingStatus={record.pricing_status} minor={record.quoted_total_minor} legacyAmount={record.total_price} />
            )}
            sorter={(a: Order, b: Order) => (a.total_price ?? -1) - (b.total_price ?? -1)}
          />
          <Table.Column
            dataIndex="payment_status"
            title="Payment"
            width={100}
            render={(v: PaymentStatus) => (
              <Tag color={PAYMENT_COLORS[v]}>
                {humanizeEnumValue(v, "Unknown")}
              </Tag>
            )}
          />
          <Table.Column
            title="Delivery"
            dataIndex="deliveryType"
            width={110}
            render={(v: string | undefined) =>
              v === "external" ? <Tag color="purple">External</Tag> :
              v === "local" ? <Tag color="blue">Local</Tag> :
              <span>—</span>
            }
          />
          <Table.Column
            dataIndex="created_at"
            title="Date"
            width={120}
            render={(v: string) => (
              <Tooltip title={formatDate(v)}>
                <span>{formatRelativeTime(v)}</span>
              </Tooltip>
            )}
            sorter={(a: Order, b: Order) =>
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            }
            defaultSortOrder="descend"
          />
          <Table.Column
            title="Action"
            key="action"
            width={180}
            render={(_v: unknown, record: Order) => {
              const validNextStatuses = record.allowed_next_statuses ?? [];
              if (validNextStatuses.length === 0) return null;

              return (
                <Select
                  placeholder="Update Status"
                  aria-label={`Update status for ${record.order_id}`}
                  style={{ width: 160 }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(val: OrderStatus) =>
                    handleStatusChange(record, val)
                  }
                  value={undefined}
                  options={validNextStatuses.map((s) => ({
                    label: ORDER_STATUS_LABELS[s],
                    value: s,
                  }))}
                />
              );
            }}
          />
          <Table.Column
            title=""
            width={50}
            render={(_: unknown, record: Order) => (
              <Tooltip title="View Details">
                <Button
                  type="text"
                  size="small"
                  aria-label={`View details for ${record.order_id}`}
                  icon={<EyeOutlined />}
                  style={{ color: "#A0A0A0" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/orders/show/${record.id}`);
                  }}
                />
              </Tooltip>
            )}
          />
        </Table>
        <Modal
          title={`Decline ${declineTarget?.order_id ?? "file"}`}
          open={declineTarget != null}
          onCancel={() => {
            setDeclineTarget(null);
            setDeclineReason("");
          }}
          onOk={() => void declineOrder()}
          okText="Decline file"
          okButtonProps={{ danger: true, disabled: !declineReason.trim() }}
        >
          <Input.TextArea
            aria-label="File decline reason"
            value={declineReason}
            onChange={(event) => setDeclineReason(event.target.value)}
            placeholder="Reason shown to the customer"
          />
        </Modal>
      </Space>
    </List>
  );
}
