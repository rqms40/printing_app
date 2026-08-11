import { List, useTable, DateField, NumberField } from "@refinedev/antd";
import {
  Table,
  Button,
  Space,
  Image,
  Typography,
  Tag,
  Select,
  Input,
  Modal,
} from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import { useApiUrl, useCustomMutation, useNotification } from "@refinedev/core";
import { useState } from "react";
import { useNotificationsContext } from "@/context/notifications-context";

const { Text } = Typography;

type QrReceiptRow = {
  id: number;
  orderId: number;
  orderRef: string | null;
  userId: number;
  userEmail: string | null;
  userName: string | null;
  receiptUrl: string | null;
  receiptFileName: string | null;
  status: "pending" | "verified" | "rejected";
  paymentMethod: string | null;
  paymentStatus: string | null;
  orderTotal: number | null;
  rejectionReason: string | null;
  createdAt: string;
};

const statusColor: Record<string, string> = {
  pending: "gold",
  verified: "green",
  rejected: "red",
};

export const QrPaymentsList = () => {
  const apiUrl = useApiUrl();
  const { open } = useNotification();
  const { refreshBadges } = useNotificationsContext();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { tableProps, tableQueryResult } = useTable({
    resource: "payments/qr-receipts",
    syncWithLocation: false,
    pagination: { mode: "off" },
    filters: {
      permanent: statusFilter
        ? [{ field: "status", operator: "eq", value: statusFilter }]
        : [],
    },
    queryOptions: {
      // Re-key when filter changes so Refine refetches
      queryKey: ["payments", "qr-receipts", statusFilter],
    } as any,
  });

  const { mutate } = useCustomMutation();
  const [busy, setBusy] = useState(false);

  const handleVerify = (id: number) => {
    setBusy(true);
    mutate(
      {
        url: `${apiUrl}/payments/qr-receipts/${id}/verify`,
        method: "post",
        values: {},
      },
      {
        onSuccess: () => {
          open?.({
            type: "success",
            message: "Payment verified",
            description:
              "Receipt marked verified. Order payment is paid; ops can authorize production.",
          });
          tableQueryResult.refetch();
          refreshBadges();
          setBusy(false);
        },
        onError: (error) => {
          open?.({
            type: "error",
            message: "Verification failed",
            description: error?.message || "An error occurred.",
          });
          setBusy(false);
        },
      },
    );
  };

  const handleRejectConfirm = () => {
    if (rejectingId == null) return;
    setBusy(true);
    mutate(
      {
        url: `${apiUrl}/payments/qr-receipts/${rejectingId}/reject`,
        method: "post",
        values: { reason: rejectReason.trim() || undefined },
      },
      {
        onSuccess: () => {
          open?.({
            type: "success",
            message: "Receipt rejected",
            description: "Customer payment marked failed for this order.",
          });
          setRejectingId(null);
          setRejectReason("");
          tableQueryResult.refetch();
          refreshBadges();
          setBusy(false);
        },
        onError: (error) => {
          open?.({
            type: "error",
            message: "Reject failed",
            description: error?.message || "An error occurred.",
          });
          setBusy(false);
        },
      },
    );
  };

  const receiptSrc = (url: string | null) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    const base = apiUrl.replace(/\/api\/?$/, "");
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  return (
    <List
      title="QR Payments"
      headerButtons={
        <Select
          value={statusFilter}
          style={{ width: 160 }}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { value: "pending", label: "Pending" },
            { value: "verified", label: "Verified" },
            { value: "rejected", label: "Rejected" },
            { value: "", label: "All" },
          ]}
        />
      }
    >
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        Customers pay via QR Ph (Instapay) and upload a digital receipt at
        checkout. Verify receipts here so payment is marked paid and production
        authorization can proceed.
      </Text>
      <Table {...tableProps} rowKey="id">
        <Table.Column
          dataIndex="id"
          title="ID"
          width={70}
          render={(val) => <Text strong>#{val}</Text>}
        />
        <Table.Column
          dataIndex="orderRef"
          title="Order"
          render={(ref, record: QrReceiptRow) => (
            <Text>
              {ref || `Order #${record.orderId}`}
            </Text>
          )}
        />
        <Table.Column
          title="Customer"
          render={(_, record: QrReceiptRow) => (
            <Space direction="vertical" size={0}>
              <Text>{record.userName || "—"}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.userEmail || `User #${record.userId}`}
              </Text>
            </Space>
          )}
        />
        <Table.Column
          dataIndex="orderTotal"
          title="Order total"
          render={(value) =>
            value != null ? (
              <NumberField
                value={value}
                options={{ style: "currency", currency: "PHP" }}
              />
            ) : (
              "—"
            )
          }
        />
        <Table.Column
          dataIndex="receiptUrl"
          title="Receipt"
          render={(url: string | null) => {
            const src = receiptSrc(url);
            return src ? (
              <Image
                src={src}
                alt="Payment receipt"
                style={{ maxWidth: 100, maxHeight: 100, objectFit: "cover" }}
                fallback="https://via.placeholder.com/100?text=No+Image"
              />
            ) : (
              <Text type="secondary">No receipt</Text>
            );
          }}
        />
        <Table.Column
          dataIndex="status"
          title="Status"
          render={(status: string) => (
            <Tag color={statusColor[status] || "default"}>
              {status?.toUpperCase()}
            </Tag>
          )}
        />
        <Table.Column
          dataIndex="paymentStatus"
          title="Payment"
          render={(s: string | null) => s || "—"}
        />
        <Table.Column
          dataIndex="createdAt"
          title="Submitted"
          render={(value) => (
            <DateField value={value} format="YYYY-MM-DD HH:mm" />
          )}
        />
        <Table.Column
          title="Actions"
          render={(_, record: QrReceiptRow) => (
            <Space>
              {record.status === "pending" && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={busy}
                    onClick={() => handleVerify(record.id)}
                  >
                    Verify
                  </Button>
                  <Button
                    danger
                    icon={<CloseCircleOutlined />}
                    loading={busy}
                    onClick={() => {
                      setRejectingId(record.id);
                      setRejectReason("");
                    }}
                  >
                    Reject
                  </Button>
                </>
              )}
              {record.status === "rejected" && record.rejectionReason && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.rejectionReason}
                </Text>
              )}
              {record.status === "verified" && (
                <Text type="success">Verified</Text>
              )}
            </Space>
          )}
        />
      </Table>

      <Modal
        title="Reject QR payment receipt"
        open={rejectingId != null}
        onCancel={() => {
          setRejectingId(null);
          setRejectReason("");
        }}
        onOk={handleRejectConfirm}
        okText="Reject"
        okButtonProps={{ danger: true, loading: busy }}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
          Optional reason shown for ops audit:
        </Text>
        <Input.TextArea
          rows={3}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="e.g. Amount does not match order total"
          maxLength={1000}
        />
      </Modal>
    </List>
  );
};
