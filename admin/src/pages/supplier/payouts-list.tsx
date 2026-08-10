import { useCallback, useEffect, useState } from 'react';
import { Alert, Space, Table, Tag, Typography } from 'antd';
import { List } from '@refinedev/antd';
import { apiClient } from '@/providers/api-client';
import { formatDateTime, formatCurrency } from '@/utils/format';
import { minorToPesos } from '@/services/superAdminApi';

const { Text } = Typography;

type SupplierPayout = {
  id: number;
  orderId: number;
  grossMinor: string;
  commissionMinor: string;
  netMinor: string;
  holdReason: string | null;
  holdExpiresAt: string | null;
  settlementState: string;
  releasedAt: string | null;
  createdAt: string;
  order?: { orderId?: string } | null;
};

const STATE_COLOR: Record<string, string> = {
  pending: 'gold',
  held: 'orange',
  released: 'green',
  settled: 'blue',
  cancelled: 'default',
};

export function SupplierPayoutsListPage() {
  const [rows, setRows] = useState<SupplierPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get('/payouts/mine');
      setRows(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <List title="My payouts">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Payout visibility"
          description="Payouts open as held for 24h after delivery (issue window). Timely claims freeze settlement until Ops resolves. Read-only for suppliers."
        />
        {error ? <Alert type="error" showIcon message={error} /> : null}
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 15 }}
          columns={[
            { title: 'ID', dataIndex: 'id', width: 70 },
            {
              title: 'Order',
              render: (_, r) => r.order?.orderId ?? r.orderId,
            },
            {
              title: 'Gross',
              render: (_, r) => formatCurrency(minorToPesos(r.grossMinor)),
            },
            {
              title: 'Commission',
              render: (_, r) =>
                formatCurrency(minorToPesos(r.commissionMinor)),
            },
            {
              title: 'Net',
              render: (_, r) => (
                <Text strong>
                  {formatCurrency(minorToPesos(r.netMinor))}
                </Text>
              ),
            },
            {
              title: 'State',
              dataIndex: 'settlementState',
              render: (s: string) => (
                <Tag color={STATE_COLOR[s] ?? 'default'}>{s}</Tag>
              ),
            },
            {
              title: 'Hold',
              render: (_, r) =>
                r.holdReason ? (
                  <Tag color="orange">{r.holdReason}</Tag>
                ) : (
                  <Text type="secondary">—</Text>
                ),
            },
            {
              title: 'Hold expires',
              dataIndex: 'holdExpiresAt',
              render: (v: string | null) =>
                v ? formatDateTime(v) : '—',
            },
            {
              title: 'Created',
              dataIndex: 'createdAt',
              render: (v: string) => formatDateTime(v),
            },
          ]}
        />
      </Space>
    </List>
  );
}
