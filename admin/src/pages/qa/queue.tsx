import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App,
  Button,
  Drawer,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  AuditOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { List } from '@refinedev/antd';
import {
  fetchPickupQaQueue,
  fetchQaQueue,
  type PickupQaSubmissionItem,
  type QaQueueItem,
} from '@/services/qaApi';
import { formatCurrency, formatRelativeTime } from '@/utils/format';
import { StatusBadge } from '@/components/status-badge';
import type { OrderStatus } from '@/types/enums';
import { PickupQaChecklistForm } from '@/components/pickup-qa-checklist';
import { emptyPickupQaChecklist } from '@/constants/pickup-qa-checklist';

const { Text } = Typography;

export function QaQueuePage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [opsRows, setOpsRows] = useState<QaQueueItem[]>([]);
  const [pickupRows, setPickupRows] = useState<PickupQaSubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickupLoading, setPickupLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ops');
  const [selectedPickup, setSelectedPickup] =
    useState<PickupQaSubmissionItem | null>(null);

  const loadOps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchQaQueue();
      setOpsRows(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load QA queue';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [message]);

  const loadPickup = useCallback(async () => {
    setPickupLoading(true);
    try {
      const data = await fetchPickupQaQueue();
      setPickupRows(data);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load Pickup QA queue';
      message.error(msg);
    } finally {
      setPickupLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void loadOps();
    void loadPickup();
  }, [loadOps, loadPickup]);

  const refresh = () => {
    void loadOps();
    void loadPickup();
  };

  return (
    <List
      title="QA Queue"
      headerButtons={
        <Button icon={<ReloadOutlined />} onClick={refresh}>
          Refresh
        </Button>
      }
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'ops',
            label: (
              <span>
                <AuditOutlined style={{ marginRight: 6 }} />
                Ops preflight ({opsRows.length})
              </span>
            ),
            children: (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Orders in <Text code>submitted</Text> or <Text code>needs_qa</Text>.
                  Opening a workspace auto-promotes submitted jobs into active QA.
                </Text>
                <Table
                  rowKey="id"
                  loading={loading}
                  dataSource={opsRows}
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
                    title="Total"
                    dataIndex="totalPrice"
                    render={(v: number) => formatCurrency(v)}
                  />
                  <Table.Column
                    title="Updated"
                    dataIndex="updatedAt"
                    render={(v: string) => formatRelativeTime(v)}
                  />
                </Table>
              </>
            ),
          },
          {
            key: 'pickup',
            label: `Pickup QA (${pickupRows.length})`,
            children: (
              <>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Supplier and rider physical Pickup QA checklist submissions.
                  Suppliers complete this after production before ready-for-pickup;
                  riders re-verify the same checklist before marking picked up.
                </Text>
                <Table
                  rowKey="id"
                  loading={pickupLoading}
                  dataSource={pickupRows}
                  pagination={{ pageSize: 20 }}
                  onRow={(record) => ({
                    onClick: () => setSelectedPickup(record),
                    style: { cursor: 'pointer' },
                  })}
                >
                  <Table.Column
                    title="When"
                    dataIndex="createdAt"
                    render={(v: string) => formatRelativeTime(v)}
                    width={110}
                  />
                  <Table.Column
                    title="Order"
                    render={(_: unknown, row: PickupQaSubmissionItem) => (
                      <Space direction="vertical" size={0}>
                        <Text strong>{row.orderPublicId || `Order #${row.orderId}`}</Text>
                        {row.orderStatus && (
                          <StatusBadge status={row.orderStatus as OrderStatus} />
                        )}
                      </Space>
                    )}
                  />
                  <Table.Column
                    title="Actor"
                    render={(_: unknown, row: PickupQaSubmissionItem) => (
                      <Space direction="vertical" size={0}>
                        <Tag color={row.actorRole === 'supplier' ? 'purple' : 'orange'}>
                          {row.actorRole}
                        </Tag>
                        <Text>{row.actorName || `User #${row.actorUserId}`}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {row.actorEmail || '—'}
                        </Text>
                      </Space>
                    )}
                  />
                  <Table.Column
                    title="Client"
                    render={(_: unknown, row: PickupQaSubmissionItem) => (
                      <Space direction="vertical" size={0}>
                        <Text>{row.clientName || '—'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {row.clientEmail || '—'}
                        </Text>
                      </Space>
                    )}
                  />
                  <Table.Column
                    title="Checks"
                    render={(_: unknown, row: PickupQaSubmissionItem) => {
                      const entries = Object.values(row.checklistResults ?? {});
                      const passed = entries.filter((e) =>
                        typeof e === 'boolean' ? e : Boolean(e?.pass),
                      ).length;
                      return (
                        <Text>
                          {passed}/{entries.length || 6} pass
                        </Text>
                      );
                    }}
                  />
                </Table>
              </>
            ),
          },
        ]}
      />

      <Drawer
        title={
          selectedPickup
            ? `Pickup QA · ${selectedPickup.orderPublicId || selectedPickup.orderId}`
            : 'Pickup QA'
        }
        open={!!selectedPickup}
        onClose={() => setSelectedPickup(null)}
        width={520}
      >
        {selectedPickup && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Tag color={selectedPickup.actorRole === 'supplier' ? 'purple' : 'orange'}>
                {selectedPickup.actorRole}
              </Tag>
              <Text style={{ marginLeft: 8 }}>
                {selectedPickup.actorName || `User #${selectedPickup.actorUserId}`}
              </Text>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatRelativeTime(selectedPickup.createdAt)}
                  {selectedPickup.notes ? ` · ${selectedPickup.notes}` : ''}
                </Text>
              </div>
            </div>
            <PickupQaChecklistForm
              value={emptyPickupQaChecklist()}
              onChange={() => undefined}
              readOnlyResults={selectedPickup.checklistResults}
              signOffLabel={
                selectedPickup.actorRole === 'supplier'
                  ? 'Supplier digital signature'
                  : selectedPickup.actorRole === 'rider'
                    ? 'Rider digital signature'
                    : 'Digital signature'
              }
            />
            {selectedPickup.evidenceFileIds?.length > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Evidence file ids: {selectedPickup.evidenceFileIds.join(', ')}
              </Text>
            )}
            <Button
              type="link"
              style={{ padding: 0 }}
              onClick={() =>
                navigate(`/orders/show/${selectedPickup.orderId}`)
              }
            >
              Open order
            </Button>
          </Space>
        )}
      </Drawer>
    </List>
  );
}
