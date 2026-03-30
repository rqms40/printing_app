import React, { useState } from "react";
import {
  Table, Tag, Avatar, Space, Typography, Input, Tooltip,
  Card, Badge, List, Button, Row, Col
} from "antd";
import {
  SearchOutlined, EnvironmentOutlined, CarOutlined,
  UserAddOutlined, DropboxOutlined, DollarOutlined, ClockCircleOutlined,
} from "@ant-design/icons";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mockDrivers, mockOrders, mockDeliveries } from "@/providers/mock-data";
import type { DriverProfile } from "@/types/driver";
import { formatDateTime, formatRelativeTime } from "@/utils/format";

const { Text, Title } = Typography;

// Fix leaflet default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Drivers Page Error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'white' }}>
          <h2>Something went wrong in the Drivers panel.</h2>
          <pre style={{ color: 'red', whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre>
          <pre style={{ color: '#aaa', fontSize: 12 }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ─── Map Icon helpers ───────────────────────────────────────────── */
const createIcon = (color: string) =>
  new DivIcon({
    className: 'custom-map-icon',
    html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.5)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const availableIcon = createIcon('#34d399');
const busyIcon      = createIcon('#60a5fa');

const VEHICLE_COLORS: Record<string, string> = {
  motorcycle: 'gold',
  bicycle:    'green',
  car:        'blue',
};

/* ─── Cost & Earnings Sidebar ────────────────────────────────────── */
const CostSidebar: React.FC = () => {
  const totalPayout     = mockDeliveries.reduce((a, d) => a + d.earnings, 0);
  const pendingCount    = mockDeliveries.filter(d =>
    ['Assigned', 'Accepted', 'Picked Up', 'On the Way'].includes(d.status)
  ).length;
  const recentEarnings  = mockDeliveries.filter(d => d.earnings > 0).slice(0, 3);

  const metricCard = (icon: React.ReactNode, label: string, value: string, color: string) => (
    <Card
      style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 10, marginBottom: 10 }}
      styles={{ body: { padding: 16 } }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: `${color}1a`, padding: 10, borderRadius: 8 }}>
          {icon}
        </div>
        <div>
          <Text style={{ color: '#808080', fontSize: 12, display: 'block' }}>{label}</Text>
          <Text strong style={{ color, fontSize: 18 }}>{value}</Text>
        </div>
      </div>
    </Card>
  );

  return (
    <>
      {metricCard(
        <DollarOutlined style={{ color: '#34d399', fontSize: 18 }} />,
        'Total Payouts Resolved',
        `₱${totalPayout.toFixed(2)}`,
        '#34d399'
      )}
      {metricCard(
        <ClockCircleOutlined style={{ color: '#FFCA28', fontSize: 18 }} />,
        'Active Rider Costs',
        `₱${(pendingCount * 90).toFixed(2)}`,
        '#FFCA28'
      )}

      {/* Recent Earnings Log */}
      <Card
        title={<Text style={{ color: '#808080', fontSize: 13 }}>Recent Earnings Log</Text>}
        style={{ background: '#141414', border: '1px solid #2E2E2E', borderRadius: 10 }}
        styles={{ body: { padding: '0 16px' }, header: { borderBottom: '1px solid #2E2E2E', padding: '10px 16px', minHeight: 'auto' } }}
      >
        {recentEarnings.map(d => (
          <div
            key={d.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid #2A2A2A', padding: '10px 0' }}
          >
            <div>
              <Text style={{ color: '#F0F0F0', fontSize: 13, display: 'block', fontWeight: 500 }}>{d.order_id}</Text>
              <Text style={{ color: '#808080', fontSize: 11 }}>{d.date}</Text>
            </div>
            <Text strong style={{ color: '#34d399', fontSize: 14 }}>+₱{d.earnings.toFixed(2)}</Text>
          </div>
        ))}
      </Card>
    </>
  );
};

/* ─── Dispatch Queue ─────────────────────────────────────────────── */
const DispatchQueuePanel: React.FC = () => {
  const readyOrders    = mockOrders.filter(o => o.order_status === 'ready_for_dispatch');
  const availDrivers   = mockDrivers.filter(d => d.is_available);
  const [assigning, setAssigning] = useState<string | null>(null);

  return (
    <Card
      title={<Text style={{ color: '#F0F0F0', fontWeight: 600 }}>Dispatch Queue</Text>}
      extra={
        <Badge
          count={`${readyOrders.length} Pending`}
          style={{ backgroundColor: '#FFDE58', color: '#141414', fontWeight: 700 }}
        />
      }
      style={{ background: '#141414', border: '1px solid #2E2E2E', borderRadius: 10, height: '100%' }}
      styles={{ body: { padding: 12, overflowY: 'auto', maxHeight: 380 } }}
    >
      {readyOrders.length === 0 ? (
        <Text type="secondary">No orders waiting for dispatch.</Text>
      ) : (
        <List
          dataSource={readyOrders}
          renderItem={order => (
            <List.Item
              style={{ background: '#1f1f1f', borderRadius: 8, marginBottom: 10,
                padding: 12, border: '1px solid #2E2E2E', display: 'block' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <Text strong style={{ color: '#F0F0F0', display: 'block' }}>{order.order_id}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Delivery Fee: ₱{order.delivery_fee.toFixed(2)}
                  </Text>
                </div>
                <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '6px 8px', borderRadius: 8 }}>
                  <DropboxOutlined style={{ color: '#22c55e', fontSize: 18 }} />
                </div>
              </div>

              {assigning === order.order_id ? (
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                    Select Rider:
                  </Text>
                  <List
                    size="small"
                    dataSource={availDrivers}
                    renderItem={driver => (
                      <List.Item
                        style={{ cursor: 'pointer', background: '#2E2E2E', borderRadius: 6,
                          marginBottom: 4, padding: '6px 10px', border: 'none' }}
                        onClick={() => setAssigning(null)}
                      >
                        <Space direction="vertical" size={0}>
                          <Text style={{ fontSize: 13, color: '#F0F0F0' }}>{driver.full_name}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {driver.vehicle_type} • {driver.plate_number}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                  <div style={{ textAlign: 'center', marginTop: 6 }}>
                    <Button type="text" size="small" onClick={() => setAssigning(null)}
                      style={{ color: '#808080' }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button
                  block ghost
                  icon={<UserAddOutlined />}
                  onClick={() => setAssigning(order.order_id)}
                  style={{ borderColor: '#FFDE58', color: '#FFDE58', marginTop: 4 }}
                >
                  Assign Rider
                </Button>
              )}
            </List.Item>
          )}
        />
      )}
    </Card>
  );
};

/* ─── Main Drivers Page ──────────────────────────────────────────── */
export function DriverList() {
  const [search, setSearch] = useState('');
  const onlineCount = mockDrivers.filter(d => d.is_available).length;

  const filtered = search
    ? mockDrivers.filter(
        d => d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
             d.plate_number?.toLowerCase().includes(search.toLowerCase())
      )
    : mockDrivers;

  const mapCenter: [number, number] = [7.132836, 125.610605];

  return (
    <ErrorBoundary>
      <div style={{ paddingBottom: 40 }}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ color: '#F0F0F0', margin: 0 }}>Drivers Panel</Title>
        <Space style={{ marginTop: 6 }}>
          <Tag color="green" style={{ fontSize: 13, padding: '2px 10px' }}>
            {onlineCount} Online
          </Tag>
          <Tag color="default" style={{ fontSize: 13, padding: '2px 10px' }}>
            {mockDrivers.length - onlineCount} Offline
          </Tag>
        </Space>
      </div>

      {/* ── Top Section: Map (left) + Cost/Dispatch (right) ──────── */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>

        {/* Live Tracking Map */}
        <Col xs={24} lg={15}>
          <Card
            title={
              <Space>
                <CarOutlined style={{ color: '#FFDE58' }} />
                <Text style={{ color: '#F0F0F0', fontWeight: 600 }}>Rider Live Tracking</Text>
              </Space>
            }
            style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12, height: '100%' }}
            styles={{ body: { padding: 0, overflow: 'hidden', borderRadius: '0 0 12px 12px', minHeight: 420 } }}
          >
            <MapContainer
              center={mapCenter}
              zoom={13}
              style={{ height: 440, width: '100%', borderRadius: '0 0 12px 12px' }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OSM &copy; CARTO'
              />
              {mockDrivers
                .filter(d => d.last_latitude && d.last_longitude)
                .map(d => (
                  <Marker
                    key={d.id}
                    position={[d.last_latitude!, d.last_longitude!]}
                    icon={d.is_available ? availableIcon : busyIcon}
                  >
                    <Popup>
                      <div style={{ color: '#000' }}>
                        <b>{d.full_name}</b><br />
                        {d.vehicle_type} — {d.plate_number}<br />
                        Status: {d.is_available ? 'Available' : 'Busy'}
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </Card>
        </Col>

        {/* Right column: Cost Tracker + Dispatch Queue */}
        <Col xs={24} lg={9}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
            <CostSidebar />
            <DispatchQueuePanel />
          </div>
        </Col>
      </Row>

      {/* ── Driver List Table ─────────────────────────────────────── */}
      <Card
        title={<Text style={{ color: '#F0F0F0', fontWeight: 600, fontSize: 15 }}>All Drivers</Text>}
        extra={
          <Input
            placeholder="Search by name or plate..."
            prefix={<SearchOutlined style={{ color: '#555' }} />}
            value={search}
            onChange={e => setSearch(e.target.value)}
            allowClear
            style={{ width: 260 }}
          />
        }
        style={{ background: '#1f1f1f', border: '1px solid #2E2E2E', borderRadius: 12 }}
        styles={{ header: { borderBottom: '1px solid #2E2E2E' } }}
      >
        <Table
          dataSource={filtered}
          rowKey="id"
          size="middle"
          scroll={{ x: 700 }}
          pagination={{
            pageSize: 20,
            showTotal: (total) => <span style={{ color: '#808080' }}>{total} drivers</span>,
          }}
        >
          {/* Driver */}
          <Table.Column
            title="Driver"
            width={220}
            render={(_: unknown, record: DriverProfile) => (
              <Space>
                <Avatar
                  size={40}
                  style={{
                    background: record.is_available ? '#1A2E1A' : '#2A2A2A',
                    color: record.is_available ? '#66BB6A' : '#808080',
                    fontWeight: 700,
                    border: `2px solid ${record.is_available ? '#66BB6A' : '#333'}`,
                  }}
                >
                  {record.full_name?.charAt(0) ?? '?'}
                </Avatar>
                <div>
                  <Text strong style={{ color: '#F0F0F0', display: 'block' }}>
                    {record.full_name ?? 'Unknown'}
                  </Text>
                  <Text style={{ color: '#808080', fontSize: 11 }}>ID: {record.user_id}</Text>
                </div>
              </Space>
            )}
          />

          {/* Vehicle */}
          <Table.Column
            dataIndex="vehicle_type"
            title="Vehicle"
            width={140}
            render={(v: string) => (
              <Tag color={VEHICLE_COLORS[v] ?? 'default'} icon={<CarOutlined />}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </Tag>
            )}
            filters={[
              { text: 'Motorcycle', value: 'motorcycle' },
              { text: 'Bicycle',    value: 'bicycle'    },
              { text: 'Car',        value: 'car'        },
            ]}
            onFilter={(value, record: DriverProfile) => record.vehicle_type === value}
          />

          {/* Plate */}
          <Table.Column
            dataIndex="plate_number"
            title="Plate"
            width={120}
            render={(v?: string) => (
              <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#F0F0F0' }}>
                {v ?? '—'}
              </span>
            )}
          />

          {/* Status */}
          <Table.Column
            dataIndex="is_available"
            title="Status"
            width={110}
            render={(available: boolean) => (
              <Tag color={available ? 'green' : 'default'}>
                {available ? 'Online' : 'Offline'}
              </Tag>
            )}
            filters={[
              { text: 'Online',  value: true  },
              { text: 'Offline', value: false },
            ]}
            onFilter={(value, record: DriverProfile) => record.is_available === value}
          />

          {/* Last Active */}
          <Table.Column
            dataIndex="last_location_update"
            title="Last Active"
            width={160}
            render={(v?: string) =>
              v ? (
                <Tooltip title={formatDateTime(v)}>
                  <Space size={4}>
                    <EnvironmentOutlined style={{ color: '#808080', fontSize: 12 }} />
                    <span style={{ color: '#A0A0A0' }}>{formatRelativeTime(v)}</span>
                  </Space>
                </Tooltip>
              ) : (
                <span style={{ color: '#555' }}>—</span>
              )
            }
          />
        </Table>
      </Card>
    </div>
    </ErrorBoundary>
  );
}
