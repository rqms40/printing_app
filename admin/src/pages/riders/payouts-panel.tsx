import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Image,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { apiClient } from "@/providers/api-client";
import { formatCurrency, formatDateTime } from "@/utils/format";
import { minorToPesos } from "@/services/superAdminApi";

const { Text } = Typography;

type RiderOption = {
  id: number;
  full_name: string | null;
  email: string | null;
};

type PayoutItem = {
  assignmentId: number;
  orderId: number;
  orderRef: string;
  amountMinor: string;
  deliveredAt: string | null;
  status: "paid" | "unpaid";
  paidAt: string | null;
  adminReceiptFileId: number | null;
  adminReceiptUrl: string | null;
};

type PayoutsView = {
  riderId: number;
  payoutQrFileId: number | null;
  payoutQrUrl: string | null;
  items: PayoutItem[];
};

export function RiderPayoutsPanel({
  riders,
  initialRiderId = null,
}: {
  riders: RiderOption[];
  initialRiderId?: number | null;
}) {
  const { message } = App.useApp();
  const [riderId, setRiderId] = useState<number | null>(
    initialRiderId ?? riders[0]?.id ?? null,
  );
  const [view, setView] = useState<PayoutsView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  useEffect(() => {
    if (initialRiderId != null) {
      setRiderId(initialRiderId);
      return;
    }
    if (riderId == null && riders[0]?.id != null) {
      setRiderId(riders[0].id);
    }
  }, [riders, riderId, initialRiderId]);

  const reload = useCallback(async () => {
    if (riderId == null) {
      setView(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(`/admin/riders/${riderId}/payouts`);
      setView(res.data ?? null);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? "Failed to load rider payouts";
      setError(Array.isArray(msg) ? msg.join(", ") : String(msg));
      setView(null);
    } finally {
      setLoading(false);
    }
  }, [riderId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const uploadReceipt = async (assignmentId: number, options: any) => {
    const { file, onSuccess, onError } = options;
    if (riderId == null) return;
    setUploadingId(assignmentId);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", "payout_receipt");
    try {
      const upload = await apiClient.post("/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const receiptFileId = Number(upload.data?.id);
      if (!Number.isInteger(receiptFileId) || receiptFileId <= 0) {
        throw new Error("Upload did not return a file id");
      }
      const res = await apiClient.post(`/admin/riders/${riderId}/payouts`, {
        assignmentId,
        receiptFileId,
      });
      setView(res.data ?? null);
      void message.success("Receipt recorded — rider payout marked paid");
      onSuccess?.("ok");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? "Failed to record payout receipt";
      void message.error(Array.isArray(msg) ? msg.join(", ") : String(msg));
      onError?.(err);
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
      <Alert
        type="info"
        showIcon
        message="Pay riders per completed delivery"
        description="Select a rider, scan or download their payout QR, then upload a GRIDGO receipt for each completed order. The receipt appears on the rider Payouts screen."
      />
      <Select
        showSearch
        placeholder="Select a rider"
        style={{ minWidth: 280 }}
        value={riderId ?? undefined}
        onChange={(value) => setRiderId(value)}
        optionFilterProp="label"
        options={riders.map((rider) => ({
          value: rider.id,
          label: rider.full_name || rider.email || `Rider #${rider.id}`,
        }))}
      />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {view && !view.payoutQrUrl ? (
        <Alert
          type="warning"
          showIcon
          message="Rider payout QR missing"
          description="The rider must upload a payout QR before you can record a receipt."
        />
      ) : null}
      {view?.payoutQrUrl ? (
        <Card size="small" title="Rider payout QR">
          <Space align="start" size="large" wrap>
            <Image
              src={view.payoutQrUrl}
              alt="Rider payout QR"
              width={160}
              style={{ objectFit: "contain" }}
            />
            <Button
              icon={<DownloadOutlined />}
              href={view.payoutQrUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Download QR
            </Button>
          </Space>
        </Card>
      ) : null}
      <Table
        rowKey="assignmentId"
        loading={loading}
        dataSource={view?.items ?? []}
        pagination={{ pageSize: 15 }}
        locale={{ emptyText: "No completed deliveries for this rider." }}
        columns={[
          { title: "Order", dataIndex: "orderRef" },
          {
            title: "Fee",
            render: (_, row) => formatCurrency(minorToPesos(row.amountMinor)),
          },
          {
            title: "Delivered",
            render: (_, row) =>
              row.deliveredAt ? formatDateTime(row.deliveredAt) : "—",
          },
          {
            title: "Status",
            render: (_, row) => (
              <Tag color={row.status === "paid" ? "green" : "gold"}>
                {row.status === "paid" ? "Paid" : "Unpaid"}
              </Tag>
            ),
          },
          {
            title: "Receipt",
            render: (_, row) =>
              row.adminReceiptUrl ? (
                <Space>
                  <Image
                    src={row.adminReceiptUrl}
                    alt={`Receipt for ${row.orderRef}`}
                    width={40}
                    height={40}
                    style={{ objectFit: "cover" }}
                  />
                  <Button
                    type="link"
                    href={row.adminReceiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open
                  </Button>
                </Space>
              ) : (
                <Text type="secondary">—</Text>
              ),
          },
          {
            title: "Action",
            render: (_, row) => (
              <Upload
                customRequest={(options) =>
                  void uploadReceipt(row.assignmentId, options)
                }
                showUploadList={false}
                accept="image/*"
                disabled={!view?.payoutQrUrl || uploadingId === row.assignmentId}
              >
                <Button
                  icon={<UploadOutlined />}
                  loading={uploadingId === row.assignmentId}
                  disabled={!view?.payoutQrUrl}
                >
                  {row.status === "paid" ? "Replace receipt" : "Upload receipt"}
                </Button>
              </Upload>
            ),
          },
        ]}
      />
    </Space>
  );
}
