import { Row, Col, Card, Typography, Table, Tag, Space, Statistic } from "antd";
import {
  ShoppingCartOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  CarOutlined,
  DollarOutlined,
  RiseOutlined,
  TeamOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { mockKPIs, mockSalesData, mockVolumeData, mockOrders } from "@/providers/mock-data";
import { Line, Column } from "@ant-design/charts";
import type { Order } from "@/types/order";
import type { OrderStatus } from "@/types/enums";

const { Title, Text } = Typography;

export function DashboardPage() {
  const kpis = mockKPIs;
  const salesData = mockSalesData;
  const volumeData = mockVolumeData;
  const recentOrders = mockOrders.slice(0, 5);

  const lineConfig = {
    data: salesData,
    xField: "month",
    yField: "value",
    color: "#FFDE58",
    smooth: true,
    height: 260,
    theme: "classicDark",
    axis: {
      y: { labelFormatter: (v: number) => `₱${(v / 1000).toFixed(0)}k` },
    },
  };

  const barConfig = {
    data: volumeData,
    xField: "month",
    yField: "value",
    color: "#5B5B5B",
    height: 260,
    theme: "classicDark",
    style: { radiusTopLeft: 4, radiusTopRight: 4 },
  };

  return (
    <div>
      {/* Welcome banner */}
      <Card
        style={{
          background: "linear-gradient(135deg, #141414 0%, #1A1A0A 100%)",
          border: "1px solid #2E2E2E",
          marginBottom: 24,
        }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ color: "#F0F0F0", margin: 0 }}>
              Welcome back, Admin
            </Title>
            <Text style={{ color: "#808080" }}>
              Here's what's happening with your print shop today.
            </Text>
          </Col>
          <Col>
            <Space size="large">
              <Statistic
                title={<span style={{ color: "#808080", fontSize: 12 }}>Today's Orders</span>}
                value={3}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: "#FFDE58", fontSize: 20 }}
              />
              <Statistic
                title={<span style={{ color: "#808080", fontSize: 12 }}>Active Drivers</span>}
                value={2}
                prefix={<TeamOutlined />}
                valueStyle={{ color: "#66BB6A", fontSize: 20 }}
              />
              <Statistic
                title={<span style={{ color: "#808080", fontSize: 12 }}>Today's Revenue</span>}
                value="₱4,150"
                prefix={<RiseOutlined />}
                valueStyle={{ color: "#FFDE58", fontSize: 20 }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* KPI Row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <KpiCard title="New Orders" value={kpis.new_orders_count} prefix={<ShoppingCartOutlined />} color="#42A5F5" />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard title="In Production" value={kpis.in_production_count} prefix={<ToolOutlined />} color="#FFCA28" />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard title="Ready for Pickup" value={kpis.ready_for_pickup_count} prefix={<CheckCircleOutlined />} color="#66BB6A" />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard title="Delivered" value={kpis.delivered_count} prefix={<CarOutlined />} color="#66BB6A" />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard title="Monthly Revenue" value={formatCurrency(kpis.monthly_revenue)} prefix={<DollarOutlined />} color="#FFDE58" />
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Sales Trend" style={{ background: "#141414" }}>
            <Line {...lineConfig} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Order Volume" style={{ background: "#141414" }}>
            <Column {...barConfig} />
          </Card>
        </Col>
      </Row>

      {/* Recent Orders Table */}
      <Card title="Recent Orders" style={{ background: "#141414", marginTop: 24 }}>
        <Table<Order> dataSource={recentOrders} rowKey="id" pagination={false} size="small">
          <Table.Column<Order>
            dataIndex="order_id"
            title="Order"
            render={(v: string) => (
              <span style={{ fontFamily: "monospace", color: "#F0F0F0" }}>{v}</span>
            )}
          />
          <Table.Column<Order>
            dataIndex="category"
            title="Type"
            render={(v: string) => (
              <Tag color={v === "paper" ? "blue" : "purple"}>{v === "paper" ? "Paper" : "3D"}</Tag>
            )}
          />
          <Table.Column<Order>
            dataIndex="order_status"
            title="Status"
            render={(s: OrderStatus) => <StatusBadge status={s} />}
          />
          <Table.Column<Order>
            dataIndex="total_price"
            title="Amount"
            render={(v: number) => formatCurrency(v)}
          />
          <Table.Column<Order>
            dataIndex="created_at"
            title="When"
            render={(v: string) => formatRelativeTime(v)}
          />
        </Table>
      </Card>
    </div>
  );
}
