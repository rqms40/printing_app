import { List } from "@refinedev/antd";
import { Table, Input, Radio, Space, Badge } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useState } from "react";
import type { Order } from "@/types/order";
import type { OrderStatus } from "@/types/enums";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { mockOrders } from "@/providers/mock-data";

type TabFilter = "new" | "production" | "done" | "all";

const TAB_STATUSES: Record<TabFilter, OrderStatus[] | null> = {
  new: ["order_placed", "file_verified"],
  production: ["printing_in_progress", "finishing_mounting", "quality_checked"],
  done: ["delivered", "completed_pickup"],
  all: null,
};

export function OrderList() {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");

  let filtered = mockOrders;
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
    new: mockOrders.filter((o) => TAB_STATUSES.new!.includes(o.order_status)).length,
    production: mockOrders.filter((o) => TAB_STATUSES.production!.includes(o.order_status)).length,
    done: mockOrders.filter((o) => TAB_STATUSES.done!.includes(o.order_status)).length,
    all: mockOrders.length,
  };

  return (
    <List title="Orders">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Space wrap>
          <Radio.Group
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="new">
              New <Badge count={counts.new} style={{ marginLeft: 4 }} />
            </Radio.Button>
            <Radio.Button value="production">
              Production <Badge count={counts.production} style={{ marginLeft: 4 }} />
            </Radio.Button>
            <Radio.Button value="done">
              Done <Badge count={counts.done} style={{ marginLeft: 4 }} />
            </Radio.Button>
            <Radio.Button value="all">
              All <Badge count={counts.all} style={{ marginLeft: 4 }} />
            </Radio.Button>
          </Radio.Group>

          <Input
            placeholder="Search by Order ID..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 250 }}
          />
        </Space>

        <Table
          dataSource={filtered}
          rowKey="id"
          pagination={{ pageSize: 20, showSizeChanger: false }}
        >
          <Table.Column
            dataIndex="order_id"
            title="Order ID"
            render={(v: string) => (
              <span style={{ fontFamily: "monospace" }}>{v}</span>
            )}
          />
          <Table.Column
            dataIndex="category"
            title="Category"
            render={(v: string) => v === "paper" ? "Paper" : "3D"}
          />
          <Table.Column
            dataIndex="order_status"
            title="Status"
            render={(status: OrderStatus) => <StatusBadge status={status} />}
          />
          <Table.Column
            dataIndex="total_price"
            title="Price"
            render={(v: number) => formatCurrency(v)}
            sorter={(a: Order, b: Order) => a.total_price - b.total_price}
          />
          <Table.Column
            dataIndex="payment_status"
            title="Payment"
            render={(v: string) => (
              <span style={{ textTransform: "capitalize" }}>{v}</span>
            )}
          />
          <Table.Column
            dataIndex="created_at"
            title="Date"
            render={(v: string) => formatRelativeTime(v)}
            sorter={(a: Order, b: Order) =>
              new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            }
            defaultSortOrder="descend"
          />
        </Table>
      </Space>
    </List>
  );
}
