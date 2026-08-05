import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { List } from "@refinedev/antd";
import {
  loadRiderVerifications,
  loadSuppliers,
  setRiderVerification,
  setSupplierVerification,
  type RiderVerificationRow,
  type SupplierProfileRow,
  type SupplierVerificationStatus,
  type RiderVerificationStatus,
} from "@/services/superAdminApi";

const { Text } = Typography;

const STATUS_COLOR: Record<string, string> = {
  pending: "gold",
  under_review: "blue",
  verified: "green",
  rejected: "red",
};

export function SuperVerificationPage() {
  const { message } = App.useApp();
  const [suppliers, setSuppliers] = useState<SupplierProfileRow[]>([]);
  const [riders, setRiders] = useState<RiderVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r] = await Promise.all([
        loadSuppliers(),
        loadRiderVerifications(),
      ]);
      setSuppliers(s);
      setRiders(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load verification queues");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSupplierDecision = async (
    row: SupplierProfileRow,
    status: SupplierVerificationStatus,
  ) => {
    const key = `s-${row.id}`;
    setBusyKey(key);
    try {
      const payoutDetailsRef =
        status === "verified"
          ? `payout:vault:supplier-${row.id}`
          : undefined;
      await setSupplierVerification(row.id, {
        status,
        payoutDetailsRef,
        notes: status === "rejected" ? "Rejected by super admin" : "Reviewed",
      });
      message.success(`Supplier #${row.id} → ${status}`);
      await reload();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Verification failed";
      message.error(typeof msg === "string" ? msg : "Verification failed");
    } finally {
      setBusyKey(null);
    }
  };

  const onRiderDecision = async (
    row: RiderVerificationRow,
    status: RiderVerificationStatus,
  ) => {
    const key = `r-${row.id}`;
    setBusyKey(key);
    try {
      await setRiderVerification(row.id, {
        status,
        notes: status === "rejected" ? "Rejected by super admin" : "Reviewed",
      });
      message.success(`Rider #${row.id} → ${status}`);
      await reload();
    } catch (e: unknown) {
      message.error("Rider verification failed");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <List title="Verification Console">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Super Admin only"
          description="Supplier and rider verification decisions are restricted to super_admin. Ops can read profiles but cannot approve."
        />
        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
            action={
              <Button type="link" onClick={() => void reload()}>
                Retry
              </Button>
            }
          />
        ) : null}
        <Tabs
          items={[
            {
              key: "suppliers",
              label: `Suppliers (${suppliers.length})`,
              children: (
                <Table
                  rowKey="id"
                  loading={loading}
                  dataSource={suppliers}
                  pagination={{ pageSize: 15 }}
                  columns={[
                    { title: "ID", dataIndex: "id", width: 70 },
                    { title: "Business", dataIndex: "businessName" },
                    { title: "User", dataIndex: "userId", width: 90 },
                    {
                      title: "Status",
                      render: (_, row) => {
                        const st = row.verification?.status ?? "pending";
                        return <Tag color={STATUS_COLOR[st]}>{st}</Tag>;
                      },
                    },
                    {
                      title: "Actions",
                      width: 280,
                      render: (_, row) => (
                        <Space>
                          <Button
                            size="small"
                            type="primary"
                            loading={busyKey === `s-${row.id}`}
                            onClick={() =>
                              void onSupplierDecision(row, "verified")
                            }
                          >
                            Verify
                          </Button>
                          <Button
                            size="small"
                            loading={busyKey === `s-${row.id}`}
                            onClick={() =>
                              void onSupplierDecision(row, "under_review")
                            }
                          >
                            Review
                          </Button>
                          <Button
                            size="small"
                            danger
                            loading={busyKey === `s-${row.id}`}
                            onClick={() =>
                              void onSupplierDecision(row, "rejected")
                            }
                          >
                            Reject
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              ),
            },
            {
              key: "riders",
              label: `Riders (${riders.length})`,
              children: (
                <Table
                  rowKey="id"
                  loading={loading}
                  dataSource={riders}
                  pagination={{ pageSize: 15 }}
                  columns={[
                    { title: "ID", dataIndex: "id", width: 70 },
                    {
                      title: "Name",
                      render: (_, r) => r.fullName ?? `User #${r.userId}`,
                    },
                    { title: "Email", dataIndex: "email" },
                    { title: "Vehicle", dataIndex: "vehicleType", width: 110 },
                    {
                      title: "Status",
                      dataIndex: "verificationStatus",
                      render: (st: string) => (
                        <Tag color={STATUS_COLOR[st] ?? "default"}>{st}</Tag>
                      ),
                    },
                    {
                      title: "Actions",
                      width: 280,
                      render: (_, row) => (
                        <Space>
                          <Button
                            size="small"
                            type="primary"
                            loading={busyKey === `r-${row.id}`}
                            onClick={() =>
                              void onRiderDecision(row, "verified")
                            }
                          >
                            Verify
                          </Button>
                          <Button
                            size="small"
                            loading={busyKey === `r-${row.id}`}
                            onClick={() =>
                              void onRiderDecision(row, "under_review")
                            }
                          >
                            Review
                          </Button>
                          <Button
                            size="small"
                            danger
                            loading={busyKey === `r-${row.id}`}
                            onClick={() =>
                              void onRiderDecision(row, "rejected")
                            }
                          >
                            Reject
                          </Button>
                        </Space>
                      ),
                    },
                  ]}
                />
              ),
            },
          ]}
        />
        <Card size="small">
          <Text type="secondary">
            Verified suppliers require a payout details reference (auto-assigned
            vault key on Verify). Unverified riders cannot be marked available
            for dispatch.
          </Text>
        </Card>
      </Space>
    </List>
  );
}
