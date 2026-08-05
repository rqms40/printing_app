import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { List } from '@refinedev/antd';
import {
  loadIssues,
  resolveIssue,
  type IssueRow,
  type ResolvePath,
} from '@/services/claimsApi';
import { formatDateTime } from '@/utils/format';

const { Text } = Typography;

const STATUS_COLOR: Record<string, string> = {
  open: 'red',
  under_review: 'orange',
  resolved_refund: 'purple',
  resolved_reprint: 'blue',
  resolved_adjustment: 'cyan',
  rejected: 'default',
  closed: 'green',
};

const RESOLVE_OPTIONS: { value: ResolvePath; label: string }[] = [
  { value: 'release', label: 'Release hold (no defect)' },
  { value: 'reject', label: 'Reject claim' },
  { value: 'reprint', label: 'Reprint (keep hold)' },
  { value: 'refund', label: 'Refund (keep hold)' },
  { value: 'adjustment', label: 'Adjustment (keep hold)' },
];

export function OpsClaimsPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<IssueRow[]>([]);
  const [status, setStatus] = useState<string | undefined>('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadIssues(status);
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onResolve = async (row: IssueRow, path: ResolvePath) => {
    setBusyId(row.id);
    try {
      await resolveIssue(row.id, {
        path,
        resolutionNotes: notes || undefined,
      });
      message.success(`Issue #${row.id} → ${path}`);
      setNotes('');
      await reload();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Resolve failed';
      message.error(typeof msg === 'string' ? msg : 'Resolve failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <List title="Claims / Issue window">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Material claims"
          description="Timely issues (within 24h of delivery) freeze supplier payouts. Resolve with release/reject to clear open_issue holds; reprint/refund keep holds until finance clears them."
        />
        {error ? <Alert type="error" showIcon message={error} /> : null}

        <Space wrap>
          <Select
            allowClear
            placeholder="Filter status"
            style={{ width: 220 }}
            value={status}
            onChange={(v) => setStatus(v)}
            options={[
              { value: 'open', label: 'Open' },
              { value: 'under_review', label: 'Under review' },
              { value: 'resolved_refund', label: 'Resolved refund' },
              { value: 'resolved_reprint', label: 'Resolved reprint' },
              { value: 'resolved_adjustment', label: 'Resolved adjustment' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
          <Input
            placeholder="Resolution notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: 320 }}
          />
          <Button onClick={() => void reload()}>Refresh</Button>
        </Space>

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
            { title: 'Category', dataIndex: 'category' },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (s: string) => (
                <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>
              ),
            },
            {
              title: 'Window',
              render: (_, r) =>
                r.withinWindow ? (
                  <Tag color="orange">within 24h</Tag>
                ) : (
                  <Tag>late</Tag>
                ),
            },
            {
              title: 'Payout impact',
              dataIndex: 'payoutImpact',
              render: (v: string) => <Text code>{v}</Text>,
            },
            {
              title: 'Opened',
              dataIndex: 'openedAt',
              render: (v: string) => formatDateTime(v),
            },
            {
              title: 'Opened by',
              render: (_, r) =>
                r.openedBy?.fullName ||
                r.openedBy?.email ||
                r.openedByUserId,
            },
            {
              title: 'Actions',
              render: (_, r) => {
                const open =
                  r.status === 'open' || r.status === 'under_review';
                if (!open) return <Text type="secondary">—</Text>;
                return (
                  <Space wrap size="small">
                    {RESOLVE_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        size="small"
                        type={
                          opt.value === 'release' || opt.value === 'reject'
                            ? 'primary'
                            : 'default'
                        }
                        danger={opt.value === 'reject'}
                        loading={busyId === r.id}
                        onClick={() => void onResolve(r, opt.value)}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </Space>
                );
              },
            },
          ]}
        />
      </Space>
    </List>
  );
}
