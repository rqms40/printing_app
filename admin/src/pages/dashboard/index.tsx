import React, { Component, ErrorInfo, ReactNode, useEffect, useState } from "react";
import { Alert, Button, Card, Col, Empty, Radio, Row, Space, Spin, Table, Tabs, Tag, Typography } from "antd";
import {
  ArrowUpOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  DropboxOutlined,
  FileTextOutlined,
  PrinterOutlined,
} from "@ant-design/icons";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatusBadge } from "@/components/status-badge";
import { apiClient } from "@/providers/api-client";
import { subscribeToOrderUpdates } from "@/providers/live-provider";
import { mockKPIs, mockOrders } from "@/providers/mock-data";
import type { Order } from "@/types/order";
import type { OrderStatus } from "@/types/enums";
import { normalizeOrders } from "@/utils/api-normalizers";
import { formatRelativeTime } from "@/utils/format";

import {
  deriveDashboardAnalyticsFromOrders,
  hasModernDashboardAnalyticsPayload,
  normalizeDashboardAnalytics,
  type DashboardAnalyticsPeriod,
  type DashboardAnalyticsPoint,
  type DashboardAnalyticsResponse,
} from "./analytics-contract";
import { UsersTab } from "./users-tab";

const { Title, Text } = Typography;

type FilterPeriod = DashboardAnalyticsPeriod;

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dashboard Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          type="error"
          message={this.state.error?.message}
          description={this.state.error?.stack}
          style={{ margin: 24 }}
        />
      );
    }

    return this.props.children;
  }
}

const cardStyle = { background: "#1f1f1f", border: "1px solid #2E2E2E", borderRadius: 12 };
const tooltipStyle = {
  backgroundColor: "#1f1f1f",
  borderColor: "#2E2E2E",
  borderRadius: 8,
  color: "#F0F0F0",
};

const emptyChart = (
  <div style={{ height: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<span style={{ color: "#808080" }}>No analytics data yet</span>}
    />
  </div>
);

function periodButtonStyle(period: FilterPeriod, value: FilterPeriod, edge?: "left" | "right") {
  return {
    background: period === value ? "#F0F0F0" : "#141414",
    color: period === value ? "#141414" : "#808080",
    borderColor: period === value ? "#F0F0F0" : "#2E2E2E",
    borderRadius: edge === "left" ? "16px 0 0 16px" : edge === "right" ? "0 16px 16px 0" : undefined,
    padding: "0 16px",
  };
}

const TatTrendChart: React.FC<{ data: DashboardAnalyticsPoint[] }> = ({ data }) => (
  <Card
    title={<Text style={{ color: "#A0A0A0", fontWeight: 400 }}>Turnaround Time (TAT) Trend</Text>}
    style={cardStyle}
    styles={{ header: { borderBottom: "1px solid #2E2E2E" } }}
  >
    {data.length === 0 ? (
      emptyChart
    ) : (
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorTat" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
          <XAxis dataKey="label" stroke="#555" fontSize={12} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            stroke="#555"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${Math.floor(value / 60)}h`}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => {
              const minutes = Number(value ?? 0);
              return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
            }}
          />
          <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTat)" />
        </AreaChart>
      </ResponsiveContainer>
    )}
  </Card>
);

const OrderVolumeChart: React.FC<{ data: DashboardAnalyticsPoint[] }> = ({ data }) => (
  <Card
    title={<Text style={{ color: "#A0A0A0", fontWeight: 400 }}>Order Volume</Text>}
    style={cardStyle}
    styles={{ header: { borderBottom: "1px solid #2E2E2E" } }}
  >
    {data.length === 0 ? (
      emptyChart
    ) : (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
          <XAxis dataKey="label" stroke="#555" fontSize={12} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="value" fill="#42A5F5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </Card>
);

const PaperSizeDemandChart: React.FC<{ data: DashboardAnalyticsPoint[] }> = ({ data }) => (
  <Card
    title={<Text style={{ color: "#F0F0F0", fontWeight: 600 }}>Paper Size Demand</Text>}
    extra={<Text style={{ color: "#808080", fontSize: 12 }}>Paper order counts by size for the selected period</Text>}
    style={cardStyle}
    styles={{ header: { borderBottom: "none" } }}
  >
    {data.length === 0 ? (
      <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={{ color: "#808080" }}>No paper-spec data yet</span>}
        />
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
          <XAxis dataKey="label" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend wrapperStyle={{ paddingTop: 16, color: "#808080", fontSize: 13 }} />
          <Bar dataKey="value" name="Orders" fill="#FFDE58" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    )}
  </Card>
);

const OperationsTab: React.FC<{ kpis: typeof mockKPIs }> = ({ kpis }) => (
  <>
    <Card style={{ ...cardStyle, marginBottom: 16 }} styles={{ body: { padding: 24 } }}>
      <Row justify="space-between" align="middle">
        <Col style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              background: "rgba(255, 222, 88, 0.15)",
              padding: "14px 18px",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ClockCircleOutlined style={{ color: "#FFDE58", fontSize: 26 }} />
          </div>
          <div>
            <Text style={{ color: "#A0A0A0", fontSize: 13, display: "block", marginBottom: 4 }}>
              Average Turnaround Time (TAT)
            </Text>
            <Title level={2} style={{ color: "#F0F0F0", margin: 0, letterSpacing: "-0.5px" }}>
              {Math.floor((kpis.avg_tat_mins || 0) / 60)}h {(kpis.avg_tat_mins || 0) % 60}m
            </Title>
          </div>
        </Col>
        <Col>
          <div
            style={{
              background: "rgba(52, 211, 153, 0.1)",
              padding: "6px 14px",
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ArrowUpOutlined style={{ color: "#34d399", fontSize: 13 }} />
            <Text style={{ color: "#34d399", fontWeight: 600, fontSize: 14 }}>12% Faster</Text>
          </div>
        </Col>
      </Row>
    </Card>

    <Row gutter={[16, 16]}>
      {[
        {
          label: "New Orders",
          value: kpis.new_orders_count,
          bg: "rgba(66, 165, 245, 0.12)",
          icon: <FileTextOutlined style={{ color: "#42A5F5", fontSize: 20 }} />,
        },
        {
          label: "In Production",
          value: kpis.in_production_count,
          bg: "rgba(255, 202, 40, 0.12)",
          icon: <PrinterOutlined style={{ color: "#FFCA28", fontSize: 20 }} />,
        },
        {
          label: "Ready For Pickup",
          value: kpis.ready_for_pickup_count,
          bg: "rgba(102, 187, 106, 0.12)",
          icon: <DropboxOutlined style={{ color: "#66BB6A", fontSize: 20 }} />,
        },
        {
          label: "Delivered",
          value: kpis.delivered_count,
          bg: "rgba(102, 187, 106, 0.12)",
          icon: <CheckCircleOutlined style={{ color: "#66BB6A", fontSize: 20 }} />,
        },
      ].map((item) => (
        <Col key={item.label} xs={12} lg={6}>
          <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <Title level={3} style={{ color: "#F0F0F0", margin: "0 0 4px 0" }}>
                  {item.value}
                </Title>
                <Text style={{ color: "#A0A0A0", fontSize: 13 }}>{item.label}</Text>
              </div>
              <div style={{ background: item.bg, padding: 10, borderRadius: 10 }}>{item.icon}</div>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  </>
);

const OrdersToolbar: React.FC<{
  period: FilterPeriod;
  setPeriod: (value: FilterPeriod) => void;
  allOrders: Order[];
}> = ({ period, setPeriod, allOrders }) => (
  <Space size={16} wrap>
    <Radio.Group value={period} onChange={(event) => setPeriod(event.target.value)} size="small" buttonStyle="solid">
      <Radio.Button value="7D" style={periodButtonStyle(period, "7D", "left")}>
        7 Days
      </Radio.Button>
      <Radio.Button value="30D" style={periodButtonStyle(period, "30D")}>
        30 Days
      </Radio.Button>
      <Radio.Button value="6M" style={periodButtonStyle(period, "6M", "right")}>
        6 Months
      </Radio.Button>
    </Radio.Group>
    <Button
      type="primary"
      icon={<DownloadOutlined />}
      style={{ background: "#FFDE58", color: "#141414", border: "none", fontWeight: 600, borderRadius: "8px" }}
      onClick={() => {
        const csvHeader = "Order_ID,Status,Created_At,Total_Price\n";
        const csvRows = allOrders.map((order) => `${order.order_id},${order.order_status},${order.created_at},${order.total_price}`).join("\n");
        const blob = new Blob([csvHeader + csvRows], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `Master_Export_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
      }}
    >
      Master CSV Export
    </Button>
  </Space>
);

const OrdersTab: React.FC<{
  period: FilterPeriod;
  setPeriod: (value: FilterPeriod) => void;
  allOrders: Order[];
  recentOrders: Order[];
  analytics: DashboardAnalyticsResponse;
}> = ({ period, setPeriod, allOrders, recentOrders, analytics }) => (
  <>
    <Card style={{ ...cardStyle, marginBottom: 24 }} styles={{ body: { padding: 20 } }}>
      <Row justify="space-between" align="middle" gutter={[16, 16]}>
        <Col>
          <Title level={4} style={{ color: "#F0F0F0", margin: 0 }}>
            Orders
          </Title>
          <Text style={{ color: "#808080", fontSize: 13 }}>
            Volume, turnaround, and demand trends for the selected range
          </Text>
        </Col>
        <Col>
          <OrdersToolbar period={period} setPeriod={setPeriod} allOrders={allOrders} />
        </Col>
      </Row>
    </Card>

    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} lg={12}>
        <TatTrendChart data={analytics.tatTrend} />
      </Col>
      <Col xs={24} lg={12}>
        <OrderVolumeChart data={analytics.volume} />
      </Col>
    </Row>

    <div style={{ marginBottom: 24 }}>
      <PaperSizeDemandChart data={analytics.paperSizeDemand} />
    </div>

    <Card
      title={<Text style={{ color: "#F0F0F0", fontWeight: 600, fontSize: 15 }}>Recent Orders</Text>}
      style={cardStyle}
      styles={{ header: { borderBottom: "1px solid #2E2E2E" } }}
    >
      <Table<Order> dataSource={recentOrders} rowKey="id" pagination={false} size="small" style={{ color: "#F0F0F0" }}>
        <Table.Column<Order>
          dataIndex="order_id"
          title="Order"
          render={(value: string) => (
            <span style={{ fontFamily: "monospace", color: "#F0F0F0", fontWeight: 500 }}>{value}</span>
          )}
        />
        <Table.Column<Order>
          dataIndex="category"
          title="Type"
          render={(value: string) => <Tag color={value === "paper" ? "blue" : "purple"}>{value === "paper" ? "Paper" : "3D"}</Tag>}
        />
        <Table.Column<Order>
          dataIndex="order_status"
          title="Status"
          render={(status: OrderStatus) => <StatusBadge status={status} />}
        />
        <Table.Column<Order>
          dataIndex="created_at"
          title="When"
          render={(value: string) => formatRelativeTime(value)}
        />
      </Table>
    </Card>
  </>
);

export function DashboardPage() {
  const [period, setPeriod] = useState<FilterPeriod>("7D");
  const [kpis, setKpis] = useState(mockKPIs);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>(mockOrders.slice(0, 5));
  const [analyticsData, setAnalyticsData] = useState<DashboardAnalyticsResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [dashboardResponse, ordersResponse] = await Promise.all([
          apiClient.get("/admin/dashboard"),
          apiClient.get("/admin/orders"),
        ]);
        const dashboard = dashboardResponse.data;
        setKpis({
          new_orders_count: dashboard.newOrdersCount,
          in_production_count: dashboard.inProductionCount,
          ready_for_pickup_count: dashboard.readyForPickupCount,
          delivered_count: dashboard.deliveredCount,
          avg_tat_mins: dashboard.avgTatMins ?? mockKPIs.avg_tat_mins,
          error_rate_percent: dashboard.errorRatePercent ?? mockKPIs.error_rate_percent,
        });
        const normalizedOrders = normalizeOrders(ordersResponse.data);
        setAllOrders(normalizedOrders);
        setRecentOrders(normalizedOrders.slice(0, 5));
      } catch {
        // keep mock fallback values already set in state
      } finally {
        setDashboardLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    return subscribeToOrderUpdates((incoming) => {
      const updated = normalizeOrders([incoming])[0];
      setAllOrders((current) => {
        const index = current.findIndex((order) => order.id === updated.id);
        if (index === -1) {
          return [updated, ...current];
        }

        const next = [...current];
        next[index] = updated;
        return next;
      });
      setRecentOrders((current) => {
        const index = current.findIndex((order) => order.id === updated.id);
        if (index !== -1) {
          const next = [...current];
          next[index] = updated;
          return next;
        }

        return [updated, ...current].slice(0, 5);
      });
      void apiClient
        .get("/admin/dashboard")
        .then((response) => {
          const dashboard = response.data;
          setKpis({
            new_orders_count: dashboard.newOrdersCount,
            in_production_count: dashboard.inProductionCount,
            ready_for_pickup_count: dashboard.readyForPickupCount,
            delivered_count: dashboard.deliveredCount,
            avg_tat_mins: dashboard.avgTatMins ?? mockKPIs.avg_tat_mins,
            error_rate_percent: dashboard.errorRatePercent ?? mockKPIs.error_rate_percent,
          });
        })
        .catch(() => {});
    });
  }, []);

  useEffect(() => {
    setAnalyticsLoading(true);

    void (async () => {
      try {
        const analyticsResponse = await apiClient.get(`/admin/analytics?period=${period}`);
        if (hasModernDashboardAnalyticsPayload(analyticsResponse.data)) {
          setAnalyticsData(normalizeDashboardAnalytics(analyticsResponse.data));
        } else {
          setAnalyticsData(null);
        }
      } catch {
        setAnalyticsData(null);
      } finally {
        setAnalyticsLoading(false);
      }
    })();
  }, [period]);

  const effectiveAnalytics = analyticsData ?? deriveDashboardAnalyticsFromOrders(allOrders, period);

  if (dashboardLoading || (analyticsLoading && !analyticsData)) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div style={{ paddingBottom: 40 }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ color: "#F0F0F0", margin: 0 }}>
            Dashboard
          </Title>
          <Text style={{ color: "#808080", fontSize: 13, display: "block", marginBottom: 20 }}>
            Welcome back, Admin
          </Text>
        </div>

        <Tabs
          defaultActiveKey="operations"
          items={[
            {
              key: "operations",
              label: "Operations",
              children: <OperationsTab kpis={kpis} />,
            },
            {
              key: "orders",
              label: "Orders",
              children: (
                <OrdersTab
                  period={period}
                  setPeriod={setPeriod}
                  allOrders={allOrders}
                  recentOrders={recentOrders}
                  analytics={effectiveAnalytics}
                />
              ),
            },
            {
              key: "users",
              label: "Users",
              children: <UsersTab />,
            },
          ]}
        />
      </div>
    </ErrorBoundary>
  );
}
