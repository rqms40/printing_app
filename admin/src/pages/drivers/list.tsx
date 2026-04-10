import React, { useState, useEffect } from "react";
import {
  Table, Tag, Avatar, Space, Typography, Input, Tooltip,
  Card, Badge, Button, Row, Col, Segmented, Statistic, App,
} from "antd";
import {
  SearchOutlined, EnvironmentOutlined, CarOutlined,
  UserAddOutlined, DropboxOutlined,
  ClockCircleOutlined, CheckCircleOutlined,
  ExpandOutlined, CompressOutlined,
} from "@ant-design/icons";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L, { DivIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { mockDeliveries } from "@/providers/mock-data";
import { formatDateTime, formatRelativeTime } from "@/utils/format";
import { apiClient } from "@/providers/api-client";
import {
  normalizeAdminDrivers,
  normalizeOrders,
} from "@/utils/api-normalizers";

const { Text, Title } = Typography;

/* ─── API Driver type ────────────────────────────────────────────── */
interface ApiDriver {
  id: number;
  user_id: number;
  full_name: string | null;
  email: string | null;
  vehicle_type: string;
  plate_number: string | null;
  is_available: boolean;
  last_latitude: number | null;
  last_longitude: number | null;
  last_location_update: string | null;
  created_at: string;
  updated_at: string;
}

// Fix leaflet default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* ─── Map Icon helpers ───────────────────────────────────────────── */
const createIcon = (color: string, size = 14) =>
  new DivIcon({
    className: '',
    html: `<div style="
      background:${color};
      width:${size}px;height:${size}px;
      border-radius:50%;
      border:2.5px solid rgba(255,255,255,0.9);
      box-shadow:0 0 0 3px ${color}33, 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2],
  });

const availableIcon = createIcon('#34d399');
const busyIcon      = createIcon('#60a5fa');

const VEHICLE_COLORS: Record<string, string> = {
  motorcycle: '#FFCA28',
  bicycle:    '#66BB6A',
  car:        '#42A5F5',
};

/* ─── Styles ────────────────────────────────────────────────────── */
const S = {
  card: {
    background: '#141414',
    border: '1px solid #2E2E2E',
    borderRadius: 12,
  } as React.CSSProperties,
  cardInner: {
    background: '#1A1A1A',
    border: '1px solid #252525',
    borderRadius: 10,
  } as React.CSSProperties,
  metricValue: {
    color: '#F0F0F0',
    fontSize: 22,
    fontWeight: 700,
    lineHeight: 1.1,
    fontFamily: "'DM Sans', sans-serif",
  } as React.CSSProperties,
  metricLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as React.CSSProperties,
  sectionTitle: {
    color: '#F0F0F0',
    fontWeight: 600,
    fontSize: 15,
    margin: 0,
  } as React.CSSProperties,
};

/* ─── Main Drivers Page ──────────────────────────────────────────── */
export function DriverList() {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [drivers, setDrivers] = useState<ApiDriver[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(true);

  useEffect(() => {
    void apiClient.get("/admin/drivers")
      .then((r) => setDrivers(normalizeAdminDrivers(r.data) as ApiDriver[]))
      .catch(() => {})
      .finally(() => setLoadingDrivers(false));
    void apiClient.get("/admin/orders")
      .then((r) => setOrders(normalizeOrders(r.data)))
      .catch(() => {});
  }, []);

  const handleAssignDriver = async (orderId: number | string, driverId: number) => {
    try {
      await apiClient.post(`/admin/orders/${orderId}/assign`, { driverId });
      void message.success('Driver assigned successfully');
      const res = await apiClient.get("/admin/orders");
      setOrders(normalizeOrders(res.data));
    } catch {
      void message.error('Failed to assign driver');
    }
  };

  const onlineCount  = drivers.filter(d => d.is_available).length;
  const offlineCount = drivers.length - onlineCount;
  const totalDeliveries = mockDeliveries.length;
  const activeTrips  = mockDeliveries.filter(d =>
    ['Assigned', 'Accepted', 'Picked Up', 'On the Way'].includes(d.status)
  ).length;
  const readyOrders  = orders.filter(o => o.order_status === 'ready_for_dispatch');

  const filtered = drivers.filter(d => {
    const matchesSearch = !search ||
      d.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      d.plate_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ? true :
      statusFilter === 'online' ? d.is_available :
      !d.is_available;
    return matchesSearch && matchesStatus;
  });

  const mapCenter: [number, number] = [7.132836, 125.610605];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* ── Header Row ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ color: '#F0F0F0', margin: 0, marginBottom: 4 }}>
            Drivers
          </Title>
          <Space size={8}>
            <Badge status="success" text={<Text style={{ color: '#808080', fontSize: 13 }}>{onlineCount} Online</Text>} />
            <Badge status="default" text={<Text style={{ color: '#808080', fontSize: 13 }}>{offlineCount} Offline</Text>} />
          </Space>
        </div>
      </div>

      {/* ── Metric Strip ───────────────────────────────────────── */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Card style={S.card} styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title={<span style={S.metricLabel}>Total Drivers</span>}
              value={drivers.length}
              valueStyle={S.metricValue}
              prefix={<CarOutlined style={{ color: '#FFDE58', fontSize: 16, marginRight: 4 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={S.card} styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title={<span style={S.metricLabel}>Active Trips</span>}
              value={activeTrips}
              valueStyle={S.metricValue}
              prefix={<EnvironmentOutlined style={{ color: '#42A5F5', fontSize: 16, marginRight: 4 }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={S.card} styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title={<span style={S.metricLabel}>Total Deliveries</span>}
              value={totalDeliveries}
              prefix={<DropboxOutlined style={{ color: '#34d399', fontSize: 16, marginRight: 4 }} />}
              valueStyle={{ ...S.metricValue, color: '#34d399' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={S.card} styles={{ body: { padding: '16px 20px' } }}>
            <Statistic
              title={<span style={S.metricLabel}>Awaiting Dispatch</span>}
              value={readyOrders.length}
              valueStyle={{ ...S.metricValue, color: '#FFDE58' }}
              prefix={<ClockCircleOutlined style={{ color: '#FFDE58', fontSize: 16, marginRight: 4 }} />}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Map + Dispatch Row ─────────────────────────────────── */}
      <Row gutter={[16, 16]}>

        {/* Live Map */}
        <Col xs={24} lg={mapExpanded ? 24 : 16}>
          <Card
            style={{ ...S.card, overflow: 'hidden' }}
            styles={{
              header: { borderBottom: '1px solid #2E2E2E', padding: '12px 20px', minHeight: 'auto' },
              body: { padding: 0 },
            }}
            title={
              <Space size={8}>
                <EnvironmentOutlined style={{ color: '#FFDE58', fontSize: 14 }} />
                <span style={{ color: '#F0F0F0', fontWeight: 600, fontSize: 14 }}>Live Tracking</span>
              </Space>
            }
            extra={
              <Button
                type="text"
                size="small"
                icon={mapExpanded ? <CompressOutlined /> : <ExpandOutlined />}
                onClick={() => setMapExpanded(v => !v)}
                style={{ color: '#808080' }}
              />
            }
          >
            <div style={{ position: 'relative', zIndex: 0, height: mapExpanded ? 500 : 340, width: '100%', isolation: 'isolate' }}>
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OSM &copy; CARTO'
                />
                {drivers
                  .filter(d => d.last_latitude && d.last_longitude)
                  .map(d => (
                    <Marker
                      key={d.id}
                      position={[d.last_latitude!, d.last_longitude!]}
                      icon={d.is_available ? availableIcon : busyIcon}
                    >
                      <Popup>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.6 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{d.full_name ?? d.email}</div>
                          <div style={{ color: '#666' }}>
                            {d.vehicle_type} &middot; {d.plate_number}
                          </div>
                          <Tag color={d.is_available ? 'green' : 'default'} style={{ marginTop: 4 }}>
                            {d.is_available ? 'Available' : 'On delivery'}
                          </Tag>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>

              {/* Map legend overlay */}
              <div style={{
                position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
                background: 'rgba(20,20,20,0.9)', backdropFilter: 'blur(8px)',
                borderRadius: 8, padding: '8px 14px',
                display: 'flex', gap: 16, fontSize: 12, color: '#A0A0A0',
                border: '1px solid #2E2E2E',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                  Available
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
                  On delivery
                </span>
              </div>
            </div>
          </Card>
        </Col>

        {/* Dispatch Queue */}
        {!mapExpanded && (
          <Col xs={24} lg={8}>
            <DispatchPanel
              readyOrders={readyOrders}
              availDrivers={drivers.filter(d => d.is_available)}
              onAssign={handleAssignDriver}
            />
          </Col>
        )}
      </Row>

      {/* ── Driver Table ───────────────────────────────────────── */}
      <div className="drivers-table-section">
        {/* Toolbar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px', flexWrap: 'wrap', gap: 10,
        }}>
          <span style={S.sectionTitle}>All Drivers</span>
          <Space size={12} wrap>
            <Segmented
              size="small"
              value={statusFilter}
              onChange={v => setStatusFilter(v as typeof statusFilter)}
              options={[
                { label: `All (${drivers.length})`, value: 'all' },
                { label: `Online (${onlineCount})`, value: 'online' },
                { label: `Offline (${offlineCount})`, value: 'offline' },
              ]}
              style={{ background: '#1A1A1A' }}
            />
            <Input
              placeholder="Search name or plate..."
              prefix={<SearchOutlined style={{ color: '#555' }} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              style={{ width: 200 }}
              size="small"
            />
          </Space>
        </div>

        {/* Table */}
        <Table
          dataSource={filtered}
          rowKey="id"
          size="middle"
          scroll={{ x: 640 }}
          pagination={false}
          loading={loadingDrivers}
        >
          <Table.Column
            title="Driver"
            width={240}
            render={(_: unknown, record: ApiDriver) => (
              <Space size={12}>
                <div style={{ position: 'relative' }}>
                  <Avatar
                    size={38}
                    style={{
                      background: record.is_available ? '#132B13' : '#1E1E1E',
                      color: record.is_available ? '#66BB6A' : '#666',
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {(record.full_name ?? record.email)?.charAt(0)?.toUpperCase() ?? '?'}
                  </Avatar>
                  <span style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: 10, height: 10, borderRadius: '50%',
                    background: record.is_available ? '#34d399' : '#444',
                    border: '2px solid #141414',
                  }} />
                </div>
                <div>
                  <Text strong style={{ color: '#F0F0F0', display: 'block', fontSize: 13.5, lineHeight: 1.3 }}>
                    {record.full_name ?? record.email ?? 'Unknown'}
                  </Text>
                  <Text style={{ color: '#666', fontSize: 11.5 }}>{record.email ?? `ID: ${record.user_id}`}</Text>
                </div>
              </Space>
            )}
          />

          <Table.Column
            dataIndex="vehicle_type"
            title="Vehicle"
            width={150}
            render={(v: string, record: ApiDriver) => (
              <Space size={8}>
                <CarOutlined style={{ color: VEHICLE_COLORS[v] ?? '#808080', fontSize: 15 }} />
                <div>
                  <Text style={{ color: '#F0F0F0', display: 'block', fontSize: 13, textTransform: 'capitalize' }}>
                    {v}
                  </Text>
                  <Text style={{ color: '#666', fontSize: 11.5, fontFamily: 'monospace' }}>
                    {record.plate_number ?? '—'}
                  </Text>
                </div>
              </Space>
            )}
          />

          <Table.Column
            dataIndex="is_available"
            title="Status"
            width={110}
            render={(available: boolean) => (
              <Tag
                color={available ? 'green' : 'default'}
                style={{ borderRadius: 10, fontSize: 12, padding: '1px 10px' }}
              >
                {available ? 'Online' : 'Offline'}
              </Tag>
            )}
          />

          <Table.Column
            title="Deliveries"
            width={100}
            render={(_: unknown, record: ApiDriver) => {
              const count = mockDeliveries.filter(d => d.driver_id === String(record.id)).length;
              return (
                <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                  <Text style={{ color: '#F0F0F0', fontSize: 13, fontWeight: 500 }}>{count} trips</Text>
                </div>
              );
            }}
          />

          <Table.Column
            dataIndex="last_location_update"
            title="Last Seen"
            width={140}
            render={(v: string | undefined, record: ApiDriver) =>
              record.last_latitude ? (
                <Tooltip title={v ? formatDateTime(v) : 'Location available'}>
                  <Space size={4}>
                    <EnvironmentOutlined style={{ color: '#555', fontSize: 12 }} />
                    <span style={{ color: '#808080', fontSize: 12.5 }}>
                      {v ? formatRelativeTime(v) : 'GPS active'}
                    </span>
                  </Space>
                </Tooltip>
              ) : (
                <span style={{ color: '#444', fontSize: 12.5 }}>No location</span>
              )
            }
          />
        </Table>
      </div>
    </div>
  );
}

/* ─── Dispatch Panel ─────────────────────────────────────────────── */
const DispatchPanel: React.FC<{
  readyOrders: any[];
  availDrivers: ApiDriver[];
  onAssign: (orderId: number | string, driverId: number) => Promise<void>;
}> = ({ readyOrders, availDrivers, onAssign }) => {
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assigningInProgress, setAssigningInProgress] = useState(false);

  const handleDriverSelect = async (orderId: number | string, driverId: number) => {
    setAssigningInProgress(true);
    await onAssign(orderId, driverId);
    setAssigning(null);
    setAssigningInProgress(false);
  };

  return (
    <Card
      style={{
        background: '#141414',
        border: '1px solid #2E2E2E',
        borderRadius: 12,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
      styles={{
        header: { borderBottom: '1px solid #2E2E2E', padding: '12px 20px', minHeight: 'auto' },
        body: { padding: 12, flex: 1, overflowY: 'auto', maxHeight: 280 },
      }}
      title={
        <span style={{ color: '#F0F0F0', fontWeight: 600, fontSize: 14 }}>Dispatch Queue</span>
      }
      extra={
        readyOrders.length > 0 && (
          <Badge
            count={readyOrders.length}
            style={{ backgroundColor: '#FFDE58', color: '#141414', fontWeight: 700, fontSize: 11 }}
          />
        )
      }
    >
      {readyOrders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <CheckCircleOutlined style={{ fontSize: 28, color: '#333', marginBottom: 8 }} />
          <Text style={{ display: 'block', color: '#555', fontSize: 13 }}>
            All orders dispatched
          </Text>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {readyOrders.map(order => (
            <div
              key={order.order_id ?? order.id}
              style={{
                background: '#1A1A1A',
                borderRadius: 10,
                padding: 14,
                border: '1px solid #252525',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <Text strong style={{ color: '#F0F0F0', display: 'block', fontSize: 13.5 }}>
                    {order.order_id ?? order.id}
                  </Text>
                  <Text style={{ color: '#666', fontSize: 11.5, textTransform: 'capitalize' }}>
                    Type: {order.category ?? 'Parcel'}
                  </Text>
                </div>
                <div style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  padding: '5px 7px',
                  borderRadius: 8,
                }}>
                  <DropboxOutlined style={{ color: '#34d399', fontSize: 16 }} />
                </div>
              </div>

              {assigning === (order.order_id ?? order.id) ? (
                <div>
                  <Text style={{ color: '#666', fontSize: 11, display: 'block', marginBottom: 6 }}>
                    Select rider:
                  </Text>
                  {availDrivers.map(driver => (
                    <div
                      key={driver.id}
                      onClick={() => !assigningInProgress && void handleDriverSelect(order.id ?? order.order_id, driver.id)}
                      style={{
                        cursor: assigningInProgress ? 'not-allowed' : 'pointer',
                        background: '#222',
                        borderRadius: 8,
                        padding: '8px 10px',
                        marginBottom: 4,
                        border: '1px solid transparent',
                        transition: 'border-color 0.15s',
                        opacity: assigningInProgress ? 0.5 : 1,
                      }}
                      onMouseEnter={e => !assigningInProgress && (e.currentTarget.style.borderColor = '#FFDE58')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
                    >
                      <Text style={{ fontSize: 13, color: '#F0F0F0', display: 'block' }}>
                        {driver.full_name ?? driver.email ?? 'Unknown'}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#666' }}>
                        {driver.vehicle_type} &middot; {driver.plate_number}
                      </Text>
                    </div>
                  ))}
                  <Button
                    type="text"
                    size="small"
                    block
                    onClick={() => setAssigning(null)}
                    disabled={assigningInProgress}
                    style={{ color: '#666', marginTop: 4, fontSize: 12 }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  block
                  ghost
                  size="small"
                  icon={<UserAddOutlined />}
                  onClick={() => setAssigning(order.order_id ?? order.id)}
                  style={{
                    borderColor: '#333',
                    color: '#FFDE58',
                    borderRadius: 8,
                    height: 32,
                    fontSize: 12.5,
                  }}
                >
                  Assign Rider
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
