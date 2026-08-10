import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App,
  Button,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  ReloadOutlined,
  ShopOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { List } from '@refinedev/antd';
import {
  fetchSupplierJobs,
  formatMinorAsCurrency,
  extractApiError,
  type SupplierJobListFilter,
  type SupplierJobListItem,
} from '@/services/supplierJobsApi';
import { formatRelativeTime, formatDateTime } from '@/utils/format';
import { StatusBadge } from '@/components/status-badge';
import type { OrderStatus } from '@/types/enums';

const { Text } = Typography;

const FILTER_OPTIONS: Array<{ label: string; value: SupplierJobListFilter }> = [
  { label: 'All active', value: 'all' },
  { label: 'Assigned', value: 'assigned' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'In production', value: 'in_production' },
];

function parseDeadlineMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Live countdown until acceptance deadline (or Expired). */
function AcceptCountdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const end = parseDeadlineMs(deadline);
  if (end == null) {
    return <Text type="secondary">—</Text>;
  }

  const remaining = end - now;
  if (remaining <= 0) {
    return <Tag color="red">Expired</Tag>;
  }

  const totalSec = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const urgent = remaining < 2 * 60 * 60 * 1000; // < 2h

  const label =
    hours > 0
      ? `${hours}h ${String(mins).padStart(2, '0')}m`
      : `${mins}m ${String(secs).padStart(2, '0')}s`;

  return (
    <Tag
      icon={<ClockCircleOutlined />}
      color={urgent ? 'orange' : 'blue'}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {label}
    </Tag>
  );
}

export function SupplierJobsListPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [filter, setFilter] = useState<SupplierJobListFilter>('all');
  const [rows, setRows] = useState<SupplierJobListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSupplierJobs(filter);
      setRows(data);
    } catch (err) {
      message.error(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [filter, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const assignedPendingCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.decision === 'pending' && r.orderStatus === 'supplier_assigned',
      ).length,
    [rows],
  );

  return (
    <List
      title="Supplier jobs"
      headerButtons={
        <Button icon={<ReloadOutlined />} onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      <Space
        direction="vertical"
        size="middle"
        style={{ width: '100%', marginBottom: 16 }}
      >
        <Text type="secondary">
          Jobs assigned to your shop. Accept within the SLA window, then
          produce, self-QC, and mark ready for rider pickup.
          {assignedPendingCount > 0 && (
            <>
              {' '}
              <Text strong>
                {assignedPendingCount} awaiting accept
              </Text>
              .
            </>
          )}
        </Text>
        <Segmented
          options={FILTER_OPTIONS}
          value={filter}
          onChange={(v) => setFilter(v as SupplierJobListFilter)}
        />
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 960 }}
        onRow={(record) => ({
          onClick: () => navigate(`/supplier/jobs/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      >
        <Table.Column
          title="Order"
          dataIndex="orderPublicId"
          render={(value: string, row: SupplierJobListItem) => (
            <Space direction="vertical" size={0}>
              <Text strong>{value}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Job #{row.id}
              </Text>
            </Space>
          )}
        />
        <Table.Column
          title="Status"
          dataIndex="orderStatus"
          render={(status: string) => (
            <StatusBadge status={status as OrderStatus} />
          )}
        />
        <Table.Column
          title="Category"
          dataIndex="category"
          render={(cat: string) => <Tag>{cat}</Tag>}
        />
        <Table.Column title="Qty" dataIndex="quantity" width={70} />
        <Table.Column
          title="Committed price"
          dataIndex="finalPriceMinor"
          render={(v: string | null) => formatMinorAsCurrency(v)}
        />
        <Table.Column
          title="Accept by"
          dataIndex="acceptanceDeadline"
          render={(deadline: string, row: SupplierJobListItem) => {
            if (row.decision !== 'pending') {
              return (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {row.decidedAt ? formatDateTime(row.decidedAt) : '—'}
                </Text>
              );
            }
            return (
              <Space direction="vertical" size={0}>
                <AcceptCountdown deadline={deadline} />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {formatDateTime(deadline)}
                </Text>
              </Space>
            );
          }}
        />
        <Table.Column
          title="Assigned"
          dataIndex="createdAt"
          render={(v: string) => formatRelativeTime(v)}
        />
        <Table.Column
          title=""
          width={120}
          fixed="right"
          render={(_: unknown, row: SupplierJobListItem) => (
            <Button
              type="primary"
              size="small"
              icon={<ShopOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/supplier/jobs/${row.id}`);
              }}
            >
              Open
            </Button>
          )}
        />
      </Table>
    </List>
  );
}
