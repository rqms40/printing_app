import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App,
  Button,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  AuditOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { List } from '@refinedev/antd';
import { fetchQaQueue, type QaQueueItem } from '@/services/qaApi';
import { formatCurrency, formatRelativeTime } from '@/utils/format';
import { StatusBadge } from '@/components/status-badge';
import type { OrderStatus } from '@/types/enums';

const { Text } = Typography;

export function QaQueuePage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [rows, setRows] = useState<QaQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchQaQueue();
      setRows(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load QA queue';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <List
      title="QA Queue"
      headerButtons={
        <Button icon={<ReloadOutlined />} onClick={() => void load()}>
          Refresh
        </Button>
      }
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Orders in <Text code>submitted</Text> or <Text code>needs_qa</Text>.
        Opening a workspace auto-promotes submitted jobs into active QA.
      </Text>
      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        pagination={{ pageSize: 20 }}
        onRow={(record) => ({
          onClick: () => navigate(`/qa/workspace/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      >
        <Table.Column
          title="Order"
          dataIndex="orderId"
          render={(value: string, row: QaQueueItem) => (
            <Space direction="vertical" size={0}>
              <Text strong>{value}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                #{row.id}
              </Text>
            </Space>
          )}
        />
        <Table.Column
          title="Client"
          render={(_: unknown, row: QaQueueItem) => (
            <Space direction="vertical" size={0}>
              <Text>{row.userFullName || '—'}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {row.userEmail || `user #${row.userId}`}
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
          render={(cat: string) => (
            <Tag>{cat}</Tag>
          )}
        />
        <Table.Column title="Qty" dataIndex="quantity" width={70} />
        <Table.Column
          title="Total"
          dataIndex="totalPrice"
          render={(v: number) => formatCurrency(v)}
        />
        <Table.Column
          title="File"
          dataIndex="fileName"
          render={(name: string | null) =>
            name ? (
              <Text ellipsis style={{ maxWidth: 140 }}>
                {name}
              </Text>
            ) : (
              <Text type="secondary">—</Text>
            )
          }
        />
        <Table.Column
          title="Submitted"
          dataIndex="createdAt"
          render={(v: string) => formatRelativeTime(v)}
        />
        <Table.Column
          title=""
          width={120}
          render={(_: unknown, row: QaQueueItem) => (
            <Button
              type="primary"
              size="small"
              icon={<AuditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/qa/workspace/${row.id}`);
              }}
            >
              Review
            </Button>
          )}
        />
      </Table>
    </List>
  );
}
