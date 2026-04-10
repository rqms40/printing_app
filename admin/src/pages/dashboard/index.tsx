import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Alert, Radio, Spin, Empty, Space, Button } from "antd";
import {
  FileTextOutlined,
  PrinterOutlined,
  DropboxOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
  DownloadOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import { StatusBadge } from "@/components/status-badge";
import { formatRelativeTime } from "@/utils/format";
import { mockKPIs, mockOrders } from "@/providers/mock-data";
import type { Order } from "@/types/order";
import type { OrderStatus } from "@/types/enums";
import { apiClient } from "@/providers/api-client";
import { normalizeOrders } from "@/utils/api-normalizers";
import { subscribeToOrderUpdates } from "@/providers/live-provider";
import {
  deriveDashboardAnalyticsFromOrders,
  hasModernDashboardAnalyticsPayload,
  normalizeDashboardAnalytics,
  type DashboardAnalyticsPoint,
  type DashboardAnalyticsPeriod,
  type DashboardAnalyticsResponse,
} from "./analytics-contract";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const { Title, Text } = Typography;

type FilterPeriod = DashboardAnalyticsPeriod;

/* ─── Error Boundary ──────────────────────────────────────────────── */
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: ReactNode}) {
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
      return <Alert type="error" message={this.state.error?.message} description={this.state.error?.stack} style={{ margin: 24 }} />;
    }
    return this.props.children;
  }
}

/* ─── Recharts Tooltip Style ─────────────────────────────────────── */
const tooltipStyle = {
  backgroundColor: '#1f1f1f',
  borderColor: '#2E2E2E',
  borderRadius: 8,
  color: '#F0F0F0',
};

const emptyChart = (
  <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={<span style={{ color: '#808080' }}>No analytics data yet</span>}
    />
  </div>
);

/* ─── TAT Trend Chart ──────────────────────────────────────────── */
const TatTrendChart: React.FC<{
  data: DashboardAnalyticsPoint[];
}> = ({ data }) => {
  return (
    <Card
      title={<Text style={{ color: '#A0A0A0', fontWeight: 400 }}>Turnaround Time (TAT) Trend</Text>}
      style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}
      styles={{ header: { borderBottom: '1px solid #2E2E2E' } }}
    >
      {data.length === 0 ? emptyChart : (
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
          <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false}
            tickFormatter={(v) => `${Math.floor(v / 60)}h`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${Math.floor(Number(v) / 60)}h ${Number(v) % 60}m`} />
          <Area type="monotone" dataKey="value" stroke="#34d399" strokeWidth={2.5}
            fillOpacity={1} fill="url(#colorTat)" />
        </AreaChart>
      </ResponsiveContainer>
      )}
    </Card>
  );
};

/* ─── Order Volume Chart ─────────────────────────────────────────── */
const OrderVolumeChart: React.FC<{
  data: DashboardAnalyticsPoint[];
}> = ({ data }) => {
  return (
    <Card
      title={<Text style={{ color: '#A0A0A0', fontWeight: 400 }}>Order Volume</Text>}
      style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}
      styles={{ header: { borderBottom: '1px solid #2E2E2E' } }}
    >
      {data.length === 0 ? emptyChart : (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
          <XAxis dataKey="label" stroke="#555" fontSize={12} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" fill="#42A5F5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      )}
    </Card>
  );
};

/* ─── Paper Size Demand Chart ────────────────────────────────────── */
const PaperSizeDemandChart: React.FC<{
  data: DashboardAnalyticsPoint[];
}> = ({ data }) => {
  return (
    <Card
      title={<Text style={{ color: '#F0F0F0', fontWeight: 600 }}>Paper Size Demand</Text>}
      extra={<Text style={{ color: '#808080', fontSize: 12 }}>Paper order counts by size for the selected period</Text>}
      style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}
      styles={{ header: { borderBottom: 'none' } }}
    >
      {data.length === 0 ? (
        <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<span style={{ color: '#808080' }}>No paper-spec data yet</span>}
          />
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
          <XAxis dataKey="label" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend wrapperStyle={{ paddingTop: 16, color: '#808080', fontSize: 13 }} />
          <Bar dataKey="value" name="Orders" fill="#FFDE58" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      )}
    </Card>
  );
};

/* ─── Main Dashboard Page ────────────────────────────────────────── */
export function DashboardPage() {
  const [period, setPeriod] = useState<FilterPeriod>('7D');
  const [kpis, setKpis] = useState(mockKPIs);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>(mockOrders.slice(0, 5));
  const [analyticsData, setAnalyticsData] = useState<DashboardAnalyticsResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [dashRes, ordersRes] = await Promise.all([
          apiClient.get("/admin/dashboard"),
          apiClient.get("/admin/orders"),
        ]);
        const d = dashRes.data;
        setKpis({
          new_orders_count: d.newOrdersCount,
          in_production_count: d.inProductionCount,
          ready_for_pickup_count: d.readyForPickupCount,
          delivered_count: d.deliveredCount,
          avg_tat_mins: d.avgTatMins ?? mockKPIs.avg_tat_mins,
          error_rate_percent: d.errorRatePercent ?? mockKPIs.error_rate_percent,
        });
        const normalizedOrders = normalizeOrders(ordersRes.data);
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
      setAllOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === updated.id);
        if (idx === -1) return [updated, ...prev];
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
      setRecentOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === updated.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [updated, ...prev].slice(0, 5);
      });
      void apiClient.get("/admin/dashboard").then((res) => {
        const d = res.data;
        setKpis({
          new_orders_count: d.newOrdersCount,
          in_production_count: d.inProductionCount,
          ready_for_pickup_count: d.readyForPickupCount,
          delivered_count: d.deliveredCount,
          avg_tat_mins: d.avgTatMins ?? mockKPIs.avg_tat_mins,
          error_rate_percent: d.errorRatePercent ?? mockKPIs.error_rate_percent,
        });
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    setAnalyticsLoading(true);

    void (async () => {
      try {
        const analyticsRes = await apiClient.get(`/admin/analytics?period=${period}`);
        if (hasModernDashboardAnalyticsPayload(analyticsRes.data)) {
          setAnalyticsData(normalizeDashboardAnalytics(analyticsRes.data));
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

  const cardStyle = { background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 };

  if (dashboardLoading || (analyticsLoading && !analyticsData)) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <ErrorBoundary>
      <div style={{ paddingBottom: 40 }}>

        {/* ── Page Header ─────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ color: '#F0F0F0', margin: 0 }}>Dashboard</Title>
          <Text style={{ color: '#808080', fontSize: 13, display: 'block', marginBottom: 20 }}>
            Welcome back, Admin
          </Text>

          <Row justify="space-between" align="middle">
            <Col>
              <Title level={4} style={{ color: '#F0F0F0', margin: 0 }}>Analytics Overview</Title>
            </Col>
            <Col>
              <Space size={16}>
                <Radio.Group
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  size="small"
                  buttonStyle="solid"
                >
                  <Radio.Button value="7D" style={{
                    background: period === '7D' ? '#F0F0F0' : '#141414',
                    color: period === '7D' ? '#141414' : '#808080',
                    borderColor: period === '7D' ? '#F0F0F0' : '#2E2E2E',
                    borderRadius: '16px 0 0 16px',
                    padding: '0 16px'
                  }}>7 Days</Radio.Button>
                  <Radio.Button value="30D" style={{
                    background: period === '30D' ? '#F0F0F0' : '#141414',
                    color: period === '30D' ? '#141414' : '#808080',
                    borderColor: period === '30D' ? '#F0F0F0' : '#2E2E2E',
                    padding: '0 16px'
                  }}>30 Days</Radio.Button>
                  <Radio.Button value="6M" style={{
                    background: period === '6M' ? '#F0F0F0' : '#141414',
                    color: period === '6M' ? '#141414' : '#808080',
                    borderColor: period === '6M' ? '#F0F0F0' : '#2E2E2E',
                    borderRadius: '0 16px 16px 0',
                    padding: '0 16px'
                  }}>6 Months</Radio.Button>
                </Radio.Group>
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />} 
                  style={{ background: '#FFDE58', color: '#141414', border: 'none', fontWeight: 600, borderRadius: '8px' }}
                  onClick={() => {
                     const csvHeader = "Order_ID,Status,Created_At,Total_Price\n";
                     const csvRows = allOrders.map(o => `${o.order_id},${o.order_status},${o.created_at},${o.total_price}`).join('\n');
                     const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
                     const url = window.URL.createObjectURL(blob);
                     const a = document.createElement('a');
                     a.href = url;
                     a.download = `Master_Export_${new Date().toISOString().slice(0,10)}.csv`;
                     a.click();
                  }}
                >
                  Master CSV Export
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* ── Row 1: Turnaround Time (full-width hero card) ─────── */}
        <Card style={{ ...cardStyle, marginBottom: 16 }} styles={{ body: { padding: 24 } }}>
          <Row justify="space-between" align="middle">
            <Col style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                background: 'rgba(255, 222, 88, 0.15)', padding: '14px 18px',
                borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <ClockCircleOutlined style={{ color: '#FFDE58', fontSize: 26 }} />
              </div>
              <div>
                <Text style={{ color: '#808080', fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Average Turnaround Time (TAT)
                </Text>
                <Title level={2} style={{ color: '#F0F0F0', margin: 0, letterSpacing: '-0.5px' }}>
                  {Math.floor((kpis.avg_tat_mins || 0) / 60)}h {(kpis.avg_tat_mins || 0) % 60}m
                </Title>
              </div>
            </Col>
            <Col>
              <div style={{
                background: 'rgba(52, 211, 153, 0.1)', padding: '6px 14px',
                borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6
              }}>
                <ArrowUpOutlined style={{ color: '#34d399', fontSize: 13 }} />
                <Text style={{ color: '#34d399', fontWeight: 600, fontSize: 14 }}>12% Faster</Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* ── Row 2: 4 KPI Cards ─────────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {/* New Orders */}
          <Col xs={12} lg={6}>
            <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Title level={3} style={{ color: '#F0F0F0', margin: '0 0 4px 0' }}>
                    {kpis.new_orders_count}
                  </Title>
                  <Text style={{ color: '#808080', fontSize: 13 }}>New Orders</Text>
                </div>
                <div style={{ background: 'rgba(66, 165, 245, 0.12)', padding: 10, borderRadius: 10 }}>
                  <FileTextOutlined style={{ color: '#42A5F5', fontSize: 20 }} />
                </div>
              </div>
            </Card>
          </Col>
          {/* In Production */}
          <Col xs={12} lg={6}>
            <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Title level={3} style={{ color: '#F0F0F0', margin: '0 0 4px 0' }}>
                    {kpis.in_production_count}
                  </Title>
                  <Text style={{ color: '#808080', fontSize: 13 }}>In Production</Text>
                </div>
                <div style={{ background: 'rgba(255, 202, 40, 0.12)', padding: 10, borderRadius: 10 }}>
                  <PrinterOutlined style={{ color: '#FFCA28', fontSize: 20 }} />
                </div>
              </div>
            </Card>
          </Col>
          {/* Ready for Pickup */}
          <Col xs={12} lg={6}>
            <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Title level={3} style={{ color: '#F0F0F0', margin: '0 0 4px 0' }}>
                    {kpis.ready_for_pickup_count}
                  </Title>
                  <Text style={{ color: '#808080', fontSize: 13 }}>Ready For Pickup</Text>
                </div>
                <div style={{ background: 'rgba(102, 187, 106, 0.12)', padding: 10, borderRadius: 10 }}>
                  <DropboxOutlined style={{ color: '#66BB6A', fontSize: 20 }} />
                </div>
              </div>
            </Card>
          </Col>
          {/* Delivered */}
          <Col xs={12} lg={6}>
            <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Title level={3} style={{ color: '#F0F0F0', margin: '0 0 4px 0' }}>
                    {kpis.delivered_count}
                  </Title>
                  <Text style={{ color: '#808080', fontSize: 13 }}>Delivered</Text>
                </div>
                <div style={{ background: 'rgba(102, 187, 106, 0.12)', padding: 10, borderRadius: 10 }}>
                  <CheckCircleOutlined style={{ color: '#66BB6A', fontSize: 20 }} />
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* ── Row 3: Sales Trend + Order Volume charts ───────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} lg={12}>
            <TatTrendChart data={effectiveAnalytics.tatTrend || []} />
          </Col>
          <Col xs={24} lg={12}>
            <OrderVolumeChart data={effectiveAnalytics.volume} />
          </Col>
        </Row>

        {/* ── Row 4: Paper Size Demand ───────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <PaperSizeDemandChart data={effectiveAnalytics.paperSizeDemand} />
        </div>

        {/* ── Row 5: Recent Orders Table ─────────────────────────── */}
        <Card
          title={<Text style={{ color: '#F0F0F0', fontWeight: 600, fontSize: 15 }}>Recent Orders</Text>}
          style={cardStyle}
          styles={{ header: { borderBottom: '1px solid #2E2E2E' } }}
        >
          <Table<Order>
            dataSource={recentOrders}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ color: '#F0F0F0' }}
          >
            <Table.Column<Order>
              dataIndex="order_id"
              title="Order"
              render={(v: string) => (
                <span style={{ fontFamily: 'monospace', color: '#F0F0F0', fontWeight: 500 }}>{v}</span>
              )}
            />
            <Table.Column<Order>
              dataIndex="category"
              title="Type"
              render={(v: string) => (
                <Tag color={v === 'paper' ? 'blue' : 'purple'}>{v === 'paper' ? 'Paper' : '3D'}</Tag>
              )}
            />
            <Table.Column<Order>
              dataIndex="order_status"
              title="Status"
              render={(s: OrderStatus) => <StatusBadge status={s} />}
            />
            <Table.Column<Order>
              dataIndex="created_at"
              title="When"
              render={(v: string) => formatRelativeTime(v)}
            />
          </Table>
        </Card>

      </div>
    </ErrorBoundary>
  );
}
