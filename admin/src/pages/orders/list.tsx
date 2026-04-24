import { List } from "@refinedev/antd";
import { Table, Input, Radio, Space, Badge, Tag, Tooltip, Select, Button, App } from "antd";
import { SearchOutlined, EyeOutlined, DownloadOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { Order } from "@/types/order";
import type { OrderStatus, PaymentStatus } from "@/types/enums";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS } from "@/types/enums";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatRelativeTime, formatDate, statusLabel } from "@/utils/format";
import { mockOrders } from "@/providers/mock-data";
import { apiClient } from "@/providers/api-client";
import { humanizeEnumValue, normalizeOrders, normalizeOrder } from "@/utils/api-normalizers";
import { subscribeToOrderUpdates } from "@/providers/live-provider";

type TabFilter = "new" | "production" | "done" | "all";

const TAB_STATUSES: Record<TabFilter, OrderStatus[] | null> = {
  new: ["order_placed", "file_verified"],
  production: ["printing_in_progress", "finishing_mounting", "quality_checked"],
  done: ["delivered", "completed_pickup"],
  all: null,
};

const PAYMENT_COLORS: Record<PaymentStatus, string> = {
  paid: "green",
  pending: "orange",
  failed: "red",
  refunded: "blue",
};

function exportDeliveredCSV(orders: Order[]) {
  const delivered = orders.filter(
    (o) => o.order_status === "delivered" || o.order_status === "completed_pickup",
  );
  const headers = ["Order ID", "User ID", "Category", "Status", "Amount", "Delivery Fee", "Total", "Payment Method", "Payment Status", "Delivery Option", "Date"];
  const rows = delivered.map((o) => [
    o.order_id,
    o.user_id,
    o.category === "paper" ? "Paper" : "3D",
    ORDER_STATUS_LABELS[o.order_status] ?? o.order_status,
    o.total_price,
    o.delivery_fee,
    o.total_price + o.delivery_fee,
    o.payment_method,
    o.payment_status,
    o.delivery_option,
    new Date(o.created_at).toLocaleDateString("en-PH"),
  ]);
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
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
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    void apiClient.get("/admin/orders")
      .then((res) => setOrders(normalizeOrders(res.data)))
      .catch(() => { /* keep mock fallback already in state */ })
      .finally(() => setLoading(false));
  }, []);

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

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    modal.confirm({
      title: "Update Status",
      icon: <ExclamationCircleOutlined />,
      content: `Change status to "${statusLabel(newStatus)}"?`,
      onOk: async () => {
        try {
          await apiClient.patch(`/admin/orders/${orderId}/status`, { status: newStatus });
          void message.success(`Status updated to ${statusLabel(newStatus)}`);
          const res = await apiClient.get(`/admin/orders/${orderId}`);
          const updated = normalizeOrder(res.data);
          setOrders((prev) => {
            const idx = prev.findIndex((o) => o.id === updated.id);
            if (idx === -1) return [updated, ...prev];
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        } catch {
          void message.error("Failed to update status");
        }
      },
    });
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
    filtered = filtered.filter((o) =>
      o.order_id.toLowerCase().includes(search.toLowerCase()) ||
      o.user_id.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase())),
    );
  }

  const counts = {
    new: orders.filter((o) => TAB_STATUSES.new!.includes(o.order_status)).length,
    production: orders.filter((o) => TAB_STATUSES.production!.includes(o.order_status)).length,
    done: orders.filter((o) => TAB_STATUSES.done!.includes(o.order_status)).length,
    all: orders.length,
  };

  return (
    <List title="Orders">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
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
              New <Badge count={counts.new} style={{ marginLeft: 6 }} size="small" />
            </Radio.Button>
            <Radio.Button value="production">
              Production <Badge count={counts.production} style={{ marginLeft: 6 }} size="small" />
            </Radio.Button>
            <Radio.Button value="done">
              Done <Badge count={counts.done} style={{ marginLeft: 6 }} size="small" />
            </Radio.Button>
            <Radio.Button value="all">
              All <Badge count={counts.all} style={{ marginLeft: 6 }} size="small" showZero />
            </Radio.Button>
          </Radio.Group>

          <Space wrap>
            <Select<OrderStatus | "all">
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              style={{ width: 200 }}
              options={[
                { value: "all", label: "All Statuses" },
                ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value: value as OrderStatus, label })),
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
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{v}</span>
            )}
          />
          <Table.Column
            title="Customer"
            width={140}
            render={(_v: unknown, record: Order) => (
              <Tooltip title={record.customer_email ?? `User ID: ${record.user_id}`}>
                <Space direction="vertical" size={0}>
                  <span style={{ fontWeight: 500, color: "#e6e6e6" }}>
                    {record.customer_name ?? "Unknown"}
                  </span>
                  <span style={{ fontFamily: "monospace", fontSize: 10, color: "#888" }}>
                    #{record.customer_id ?? record.user_id?.split("-")[0] ?? "—"}
                  </span>
                </Space>
              </Tooltip>
            )}
          />
          <Table.Column
            dataIndex="category"
            title="Type"
            width={80}
            render={(v: string) => (
              <Tag color={v === "paper" ? "blue" : "purple"}>
                {v === "paper" ? "Paper" : "3D"}
              </Tag>
            )}
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
            render={(v: number) => (
              <span style={{ fontWeight: 500 }}>{formatCurrency(v)}</span>
            )}
            sorter={(a: Order, b: Order) => a.total_price - b.total_price}
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
            dataIndex="created_at"
            title="Date"
            width={120}
            render={(v: string) => (
              <Tooltip title={formatDate(v)}>
                <span>{formatRelativeTime(v)}</span>
              </Tooltip>
            )}
            sorter={(a: Order, b: Order) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            }
            defaultSortOrder="descend"
          />
          <Table.Column
            title="Action"
            key="action"
            width={180}
            render={(_v: unknown, record: Order) => {
              const validNextStatuses = ORDER_STATUS_TRANSITIONS[record.order_status] || [];
              if (validNextStatuses.length === 0) return null;
              
              return (
                <Select
                  placeholder="Update Status"
                  style={{ width: 160 }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(val: OrderStatus) => handleStatusChange(record.id, val)}
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
                <EyeOutlined
                  style={{ color: "#808080", fontSize: 16 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/orders/show/${record.id}`);
                  }}
                />
              </Tooltip>
            )}
          />
        </Table>
      </Space>
    </List>
  );
}
