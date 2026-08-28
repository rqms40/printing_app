import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Image,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { List } from '@refinedev/antd';
import { useGetIdentity } from '@refinedev/core';
import { Navigate } from 'react-router-dom';
import { apiClient } from '@/providers/api-client';
import { formatDateTime, formatCurrency } from '@/utils/format';
import { minorToPesos } from '@/services/superAdminApi';
import { isSupplierRole } from '@/types/enums';
import type { AdminIdentity } from '@/utils/api-normalizers';

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
  authorizedAt?: string | null;
  adminReceiptFileId?: number | null;
  adminReceiptUrl?: string | null;
  depositAmountMinor?: string | null;
  completionAmountMinor?: string | null;
  completionAuthorizedAt?: string | null;
  completionReceiptFileId?: number | null;
  completionReceiptUrl?: string | null;
  payoutQrUrl?: string | null;
  order?: { orderId?: string } | null;
};

const STATE_COLOR: Record<string, string> = {
  Paid: 'green',
  '50% paid': 'blue',
  Held: 'orange',
  Cancelled: 'default',
};

function supplierPayoutStatus(row: SupplierPayout): string {
  const state = (row.settlementState ?? '').toLowerCase();
  if (state === 'cancelled') return 'Cancelled';
  if (state === 'held' && !row.authorizedAt) return 'Held';
  if (row.authorizedAt && !row.completionAuthorizedAt) return '50% paid';
  return 'Paid';
}

export function SupplierPayoutsListPage() {
  const { message } = App.useApp();
  const [rows, setRows] = useState<SupplierPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payoutQrUrl, setPayoutQrUrl] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const { data: identity, isLoading: isIdentityLoading } = useGetIdentity<AdminIdentity>();

  const reload = useCallback(async () => {
    if (!isSupplierRole(identity?.role)) return;
    setLoading(true);
    setError(null);
    try {
      const [payoutsRes, meRes] = await Promise.all([
        apiClient.get('/payouts/mine'),
        apiClient.get('/suppliers/me'),
      ]);
      setRows(payoutsRes.data ?? []);
      setPayoutQrUrl(meRes.data?.payoutQrUrl ?? meRes.data?.payout_qr_url ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, [identity?.role]);

  useEffect(() => {
    if (!isIdentityLoading) {
      void reload();
    }
  }, [reload, isIdentityLoading]);

  const uploadPayoutQr = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setUploadingQr(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', 'supplier_payout_qr');
    try {
      const res = await apiClient.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileId = Number(res.data?.id);
      if (!Number.isInteger(fileId) || fileId <= 0) {
        throw new Error('Upload did not return a file id');
      }
      await apiClient.patch('/suppliers/me', { payoutQrFileId: fileId });
      void message.success('Payout QR uploaded');
      onSuccess?.('ok');
      void reload();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Payout QR upload failed';
      void message.error(Array.isArray(msg) ? msg.join(', ') : String(msg));
      onError?.(err);
    } finally {
      setUploadingQr(false);
    }
  };

  if (!isIdentityLoading && !isSupplierRole(identity?.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <List title="My payouts">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Payout QR for GRIDGO payment"
          description="Upload the Instapay / wallet QR ops uses to pay you. GRIDGO pays 50% when production is authorized and the remaining 50% after the order is completed. Receipts appear on each payout below."
        />
        <Card title="Payout QR" size="small">
          <Space align="start" size="large" wrap>
            {payoutQrUrl ? (
              <Space direction="vertical">
                <Image
                  src={payoutQrUrl}
                  alt="Payout QR"
                  width={160}
                  style={{ objectFit: 'contain' }}
                />
                <Button
                  icon={<DownloadOutlined />}
                  href={payoutQrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Download QR
                </Button>
              </Space>
            ) : (
              <Text type="secondary">No payout QR uploaded yet.</Text>
            )}
            <Upload
              customRequest={uploadPayoutQr}
              showUploadList={false}
              accept="image/*"
              disabled={uploadingQr}
            >
              <Button icon={<UploadOutlined />} loading={uploadingQr}>
                {payoutQrUrl ? 'Replace QR' : 'Upload QR'}
              </Button>
            </Upload>
          </Space>
        </Card>
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
              title: 'Total',
              render: (_, r) => (
                <Text strong>
                  {formatCurrency(minorToPesos(r.grossMinor))}
                </Text>
              ),
            },
            {
              title: 'State',
              render: (_, r) => {
                const status = supplierPayoutStatus(r);
                return (
                  <Tag color={STATE_COLOR[status] ?? 'default'}>{status}</Tag>
                );
              },
            },
            {
              title: 'First 50%',
              render: (_, r) =>
                r.authorizedAt ? (
                  <Space direction="vertical" size={0}>
                    <Text>
                      {formatCurrency(
                        minorToPesos(r.depositAmountMinor ?? '0'),
                      )}
                    </Text>
                    <Text type="secondary">{formatDateTime(r.authorizedAt)}</Text>
                    {r.adminReceiptUrl ? (
                      <Space>
                        <Image
                          src={r.adminReceiptUrl}
                          alt={`First receipt for payout ${r.id}`}
                          width={48}
                          height={48}
                          style={{ objectFit: 'cover' }}
                        />
                        <Button
                          type="link"
                          href={r.adminReceiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </Button>
                      </Space>
                    ) : null}
                  </Space>
                ) : (
                  <Text type="secondary">—</Text>
                ),
            },
            {
              title: 'Final 50%',
              render: (_, r) =>
                r.completionAuthorizedAt ? (
                  <Space direction="vertical" size={0}>
                    <Text>
                      {formatCurrency(
                        minorToPesos(r.completionAmountMinor ?? '0'),
                      )}
                    </Text>
                    <Text type="secondary">
                      {formatDateTime(r.completionAuthorizedAt)}
                    </Text>
                    {r.completionReceiptUrl ? (
                      <Space>
                        <Image
                          src={r.completionReceiptUrl}
                          alt={`Final receipt for payout ${r.id}`}
                          width={48}
                          height={48}
                          style={{ objectFit: 'cover' }}
                        />
                        <Button
                          type="link"
                          href={r.completionReceiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </Button>
                      </Space>
                    ) : null}
                  </Space>
                ) : (
                  <Text type="secondary">Unpaid</Text>
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
