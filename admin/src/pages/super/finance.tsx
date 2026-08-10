import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { List } from "@refinedev/antd";
import {
  approvePayout,
  loadCodQueue,
  loadPayouts,
  minorToPesos,
  reconcileCod,
  type CodCollectionRow,
  type PayoutRow,
} from "@/services/superAdminApi";
import { formatDateTime, formatCurrency } from "@/utils/format";

const { Text } = Typography;

const STATE_COLOR: Record<string, string> = {
  pending: "gold",
  held: "orange",
  released: "green",
  settled: "blue",
  cancelled: "default",
  collected: "blue",
  reconciled: "green",
  failed: "red",
};

export function SuperFinancePage() {
  const { message } = App.useApp();
  const [codRows, setCodRows] = useState<CodCollectionRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [codStatus, setCodStatus] = useState("collected");
  const [payoutState, setPayoutState] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [settlementRef, setSettlementRef] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cod, pay] = await Promise.all([
        loadCodQueue(codStatus),
        loadPayouts(payoutState),
      ]);
      setCodRows(cod);
      setPayouts(pay);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load finance queues");
    } finally {
      setLoading(false);
    }
  }, [codStatus, payoutState]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onReconcile = async (row: CodCollectionRow) => {
    const key = `cod-${row.orderId}`;
    setBusyKey(key);
    try {
      await reconcileCod(row.orderId);
      message.success(`Order ${row.orderId} COD reconciled`);
      await reload();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Reconcile failed";
      message.error(typeof msg === "string" ? msg : "Reconcile failed");
    } finally {
      setBusyKey(null);
    }
  };

  const onApprove = async (row: PayoutRow) => {
    const key = `pay-${row.id}`;
    setBusyKey(key);
    try {
      await approvePayout(row.id, settlementRef || undefined);
      message.success(`Payout #${row.id} released`);
      await reload();
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string; code?: string } } })
        ?.response?.data;
      message.error(
        typeof data?.message === "string"
          ? data.message
          : "Payout approval failed (COD recon may be required)",
      );
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <List title="COD Recon & Payouts">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Finance controls"
          description="Reconcile collected COD before approving supplier payouts. Release is blocked while hold_reason is missing_cod_reconciliation."
        />
        {error ? (
          <Alert type="error" showIcon message={error} />
        ) : null}

        <Tabs
          items={[
            {
              key: "cod",
              label: `COD recon (${codRows.length})`,
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Select
                    value={codStatus}
                    style={{ width: 200 }}
                    onChange={setCodStatus}
                    options={[
                      { value: "collected", label: "Collected" },
                      { value: "pending", label: "Pending" },
                      { value: "reconciled", label: "Reconciled" },
                      { value: "failed", label: "Failed" },
                    ]}
                  />
                  <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={codRows}
                    pagination={{ pageSize: 15 }}
                    columns={[
                      { title: "ID", dataIndex: "id", width: 70 },
                      {
                        title: "Order",
                        render: (_, r) =>
                          r.order?.orderId ?? r.orderId,
                      },
                      {
                        title: "Amount",
                        dataIndex: "amountMinor",
                        render: (v: string) =>
                          formatCurrency(minorToPesos(v)),
                      },
                      {
                        title: "Status",
                        dataIndex: "status",
                        render: (s: string) => (
                          <Tag color={STATE_COLOR[s] ?? "default"}>{s}</Tag>
                        ),
                      },
                      {
                        title: "Collected",
                        dataIndex: "collectedAt",
                        render: (v: string | null) =>
                          v ? formatDateTime(v) : "—",
                      },
                      {
                        title: "Action",
                        width: 140,
                        render: (_, row) =>
                          row.status === "collected" ? (
                            <Button
                              type="primary"
                              size="small"
                              loading={busyKey === `cod-${row.orderId}`}
                              onClick={() => void onReconcile(row)}
                            >
                              Reconcile
                            </Button>
                          ) : (
                            <Text type="secondary">—</Text>
                          ),
                      },
                    ]}
                  />
                </Space>
              ),
            },
            {
              key: "payouts",
              label: `Payouts (${payouts.length})`,
              children: (
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Space wrap>
                    <Select
                      allowClear
                      placeholder="Settlement state"
                      style={{ width: 180 }}
                      value={payoutState}
                      onChange={(v) => setPayoutState(v)}
                      options={[
                        { value: "pending", label: "Pending" },
                        { value: "held", label: "Held" },
                        { value: "released", label: "Released" },
                        { value: "settled", label: "Settled" },
                      ]}
                    />
                    <Input
                      placeholder="Settlement ref (optional)"
                      value={settlementRef}
                      onChange={(e) => setSettlementRef(e.target.value)}
                      style={{ width: 220 }}
                    />
                    <Button onClick={() => void reload()}>Refresh</Button>
                  </Space>
                  <Table
                    rowKey="id"
                    loading={loading}
                    dataSource={payouts}
                    pagination={{ pageSize: 15 }}
                    scroll={{ x: 900 }}
                    columns={[
                      { title: "ID", dataIndex: "id", width: 70 },
                      { title: "Order", dataIndex: "orderId", width: 90 },
                      { title: "Supplier", dataIndex: "supplierId", width: 100 },
                      {
                        title: "Gross",
                        dataIndex: "grossMinor",
                        render: (v: string) =>
                          formatCurrency(minorToPesos(v)),
                      },
                      {
                        title: "Commission",
                        dataIndex: "commissionMinor",
                        render: (v: string) =>
                          formatCurrency(minorToPesos(v)),
                      },
                      {
                        title: "Net",
                        dataIndex: "netMinor",
                        render: (v: string) =>
                          formatCurrency(minorToPesos(v)),
                      },
                      {
                        title: "State",
                        dataIndex: "settlementState",
                        render: (s: string) => (
                          <Tag color={STATE_COLOR[s] ?? "default"}>{s}</Tag>
                        ),
                      },
                      {
                        title: "Hold",
                        dataIndex: "holdReason",
                        ellipsis: true,
                        render: (v: string | null) => v ?? "—",
                      },
                      {
                        title: "Action",
                        width: 120,
                        render: (_, row) =>
                          row.settlementState === "pending" ||
                          row.settlementState === "held" ? (
                            <Button
                              type="primary"
                              size="small"
                              loading={busyKey === `pay-${row.id}`}
                              onClick={() => void onApprove(row)}
                            >
                              Approve
                            </Button>
                          ) : (
                            <Text type="secondary">—</Text>
                          ),
                      },
                    ]}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </List>
  );
}
