import { List } from "@refinedev/antd";
import { Table, Input, Radio, Space, Badge, Tag, Tooltip } from "antd";
import { SearchOutlined, EyeOutlined } from "@ant-design/icons";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import type { Order } from "@/types/order";
import type { OrderStatus, PaymentStatus } from "@/types/enums";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatRelativeTime, formatDate } from "@/utils/format";
import { mockOrders } from "@/providers/mock-data";
import { API_URL } from "@/config/constants";

const axiosInstance = axios.create();
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('grid_admin_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

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

export function OrderList() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    void axiosInstance.get<Order[]>(`${API_URL}/admin/orders`)
      .then(res => setOrders(res.data))
      .catch(() => { /* keep mock fallback already in state */ })
      .finally(() => setLoading(false));
  }, []);

  let filtered = orders;
  const tabStatuses = TAB_STATUSES[activeTab];
  if (tabStatuses) {
    filtered = filtered.filter((o) => tabStatuses.includes(o.order_status));
  }
  if (search) {
    filtered = filtered.filter((o) =>
      o.order_id.toLowerCase().includes(search.toLowerCase()),
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
            onChange={(e) => setActiveTab(e.target.value)}
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

          <Input
            placeholder="Search by Order ID..."
            prefix={<SearchOutlined style={{ color: "#555" }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 240 }}
          />
        </Space>

        <Table
          dataSource={filtered}
          rowKey="id"
          size="middle"
          loading={loading}
          scroll={{ x: 800 }}
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
                {v.charAt(0).toUpperCase() + v.slice(1)}
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
