import React, { Component, ErrorInfo, ReactNode, useState, useMemo, useEffect } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Alert, Radio, Spin } from "antd";
import {
  FileTextOutlined,
  PrinterOutlined,
  DropboxOutlined,
  CheckCircleOutlined,
  ArrowUpOutlined,
} from "@ant-design/icons";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatRelativeTime } from "@/utils/format";
import { mockKPIs, mockOrders } from "@/providers/mock-data";
import type { Order } from "@/types/order";
import type { OrderStatus } from "@/types/enums";
import { apiClient } from "@/providers/api-client";
import { normalizeOrders } from "@/utils/api-normalizers";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const { Title, Text } = Typography;

type FilterPeriod = '7D' | '30D' | '6M';

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

/* ─── Sales Trend Chart ──────────────────────────────────────────── */
const SalesTrendChart: React.FC<{
  period: FilterPeriod;
  apiSalesData?: { month: string; value: number }[];
}> = ({ period, apiSalesData }) => {
  const data = useMemo(() => {
    if (period === '7D') return [
      { name: 'Mon', revenue: 4200 }, { name: 'Tue', revenue: 3800 },
      { name: 'Wed', revenue: 5100 }, { name: 'Thu', revenue: 4700 },
      { name: 'Fri', revenue: 6200 }, { name: 'Sat', revenue: 7400 }, { name: 'Sun', revenue: 5900 },
    ];
    if (period === '30D') return Array.from({ length: 10 }, (_, i) => ({
      name: `W${i + 1}`, revenue: Math.floor(Math.random() * 15000) + 8000,
    }));
    // 6M
    if (apiSalesData && apiSalesData.length > 0) {
      return apiSalesData.map(({ month, value }) => ({ name: month, revenue: value }));
    }
    // fallback to static
    return [
      { name: 'Oct', revenue: 32000 }, { name: 'Nov', revenue: 38500 },
      { name: 'Dec', revenue: 41000 }, { name: 'Jan', revenue: 35200 },
      { name: 'Feb', revenue: 42800 }, { name: 'Mar', revenue: 45200 },
    ];
  }, [period, apiSalesData]);

  return (
    <Card
      title={<Text style={{ color: '#A0A0A0', fontWeight: 400 }}>Sales Trend</Text>}
      style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}
      styles={{ header: { borderBottom: '1px solid #2E2E2E' } }}
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FFDE58" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#FFDE58" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
          <XAxis dataKey="name" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false}
            tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `₱${Number(v).toLocaleString()}`} />
          <Area type="monotone" dataKey="revenue" stroke="#FFDE58" strokeWidth={2.5}
            fillOpacity={1} fill="url(#colorRevenue)" />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
};

/* ─── Order Volume Chart ─────────────────────────────────────────── */
const OrderVolumeChart: React.FC<{
  period: FilterPeriod;
  apiVolumeData?: { month: string; value: number }[];
}> = ({ period, apiVolumeData }) => {
  const data = useMemo(() => {
    if (period === '7D') return [
      { name: 'Mon', count: 120 }, { name: 'Tue', count: 150 },
      { name: 'Wed', count: 200 }, { name: 'Thu', count: 180 },
      { name: 'Fri', count: 240 }, { name: 'Sat', count: 300 }, { name: 'Sun', count: 190 },
    ];
    if (period === '30D') return Array.from({ length: 10 }, (_, i) => ({
      name: `W${i + 1}`, count: Math.floor(Math.random() * 200) + 50,
    }));
    // 6M
    if (apiVolumeData && apiVolumeData.length > 0) {
      return apiVolumeData.map(({ month, value }) => ({ name: month, count: value }));
    }
    // fallback to static
    return [
      { name: 'Oct', count: 85 }, { name: 'Nov', count: 102 },
      { name: 'Dec', count: 115 }, { name: 'Jan', count: 94 },
      { name: 'Feb', count: 110 }, { name: 'Mar', count: 128 },
    ];
  }, [period, apiVolumeData]);

  return (
    <Card
      title={<Text style={{ color: '#A0A0A0', fontWeight: 400 }}>Order Volume</Text>}
      style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}
      styles={{ header: { borderBottom: '1px solid #2E2E2E' } }}
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
          <XAxis dataKey="name" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="count" fill="#42A5F5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

/* ─── Storage Tracking Chart (recharts inline) ───────────────────── */
const StorageChartRecharts: React.FC = () => {
  const data = [
    { size: 'A5',           Student: 350,  Employee: 80  },
    { size: 'A4',           Student: 1800, Employee: 1250 },
    { size: 'A3',           Student: 240,  Employee: 410  },
    { size: 'A2',           Student: 90,   Employee: 280  },
    { size: 'A1',           Student: 40,   Employee: 150  },
    { size: 'Poster(20x30)', Student: 120, Employee: 300  },
  ];
  return (
    <Card
      title={<Text style={{ color: '#F0F0F0', fontWeight: 600 }}>Document Print Storage Tracking</Text>}
      extra={<Text style={{ color: '#808080', fontSize: 12 }}>Print volume by dimension & user segment</Text>}
      style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}
      styles={{ header: { borderBottom: 'none' } }}
    >
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
          <XAxis dataKey="size" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Legend wrapperStyle={{ paddingTop: 16, color: '#808080', fontSize: 13 }} />
          <Bar dataKey="Student"  fill="#42A5F5" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Employee" fill="#FFCA28" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};

/* ─── Main Dashboard Page ────────────────────────────────────────── */
export function DashboardPage() {
  const [period, setPeriod] = useState<FilterPeriod>('7D');
  const [kpis, setKpis] = useState(mockKPIs);
  const [recentOrders, setRecentOrders] = useState<Order[]>(mockOrders.slice(0, 5));
  const [analyticsData, setAnalyticsData] = useState<{
    sales: { month: string; value: number }[];
    volume: { month: string; value: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [dashRes, analyticsRes, ordersRes] = await Promise.all([
          apiClient.get("/admin/dashboard"),
          apiClient.get("/admin/analytics"),
          apiClient.get("/admin/orders"),
        ]);
        const d = dashRes.data;
        setKpis({
          new_orders_count: d.newOrdersCount,
          in_production_count: d.inProductionCount,
          ready_for_pickup_count: d.readyForPickupCount,
          delivered_count: d.deliveredCount,
          monthly_revenue: d.monthlyRevenue,
        });
        setAnalyticsData({
          sales: (analyticsRes.data.sales as { month: string; value: number }[]).map(
            ({ month, value }) => ({ month, value })
          ),
          volume: (analyticsRes.data.volume as { month: string; value: number }[]).map(
            ({ month, value }) => ({ month, value })
          ),
        });
        setRecentOrders(normalizeOrders(ordersRes.data).slice(0, 5));
      } catch {
        // keep mock fallback values already set in state
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cardStyle = { background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 };

  if (loading) {
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
            </Col>
          </Row>
        </div>

        {/* ── Row 1: Monthly Revenue (full-width hero card) ─────── */}
        <Card style={{ ...cardStyle, marginBottom: 16 }} styles={{ body: { padding: 24 } }}>
          <Row justify="space-between" align="middle">
            <Col style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                background: 'rgba(255, 222, 88, 0.15)', padding: '14px 18px',
                borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{ color: '#FFDE58', fontSize: 26, fontWeight: 'bold', lineHeight: 1 }}>₱</span>
              </div>
              <div>
                <Text style={{ color: '#808080', fontSize: 13, display: 'block', marginBottom: 4 }}>
                  Monthly Revenue
                </Text>
                <Title level={2} style={{ color: '#F0F0F0', margin: 0, letterSpacing: '-0.5px' }}>
                  {formatCurrency(kpis.monthly_revenue)}
                </Title>
              </div>
            </Col>
            <Col>
              <div style={{
                background: 'rgba(52, 211, 153, 0.1)', padding: '6px 14px',
                borderRadius: 999, display: 'flex', alignItems: 'center', gap: 6
              }}>
                <ArrowUpOutlined style={{ color: '#34d399', fontSize: 13 }} />
                <Text style={{ color: '#34d399', fontWeight: 600, fontSize: 14 }}>12%</Text>
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
            <SalesTrendChart period={period} apiSalesData={analyticsData?.sales} />
          </Col>
          <Col xs={24} lg={12}>
            <OrderVolumeChart period={period} apiVolumeData={analyticsData?.volume} />
          </Col>
        </Row>

        {/* ── Row 4: Document Print Storage Tracking ─────────────── */}
        <div style={{ marginBottom: 24 }}>
          <StorageChartRecharts />
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
    </ErrorBoundary>
  );
}
