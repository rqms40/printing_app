import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
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

const { Text, Paragraph } = Typography;

const STATUS_COLOR: Record<string, string> = {
  pending: "gold",
  under_review: "blue",
  verified: "green",
  rejected: "red",
};

function SupplierExpandedDetails({ row }: { row: SupplierProfileRow }) {
  const attrs = Object.entries(row.attributes ?? {});
  const zones = row.serviceZones ?? [];
  const caps = row.capabilities ?? [];

  return (
    <Space direction="vertical" size="small" style={{ width: "100%" }}>
      <Descriptions size="small" column={2} bordered>
        <Descriptions.Item label="Description" span={2}>
          {row.description?.trim() || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Phone">
          {row.contactPhone || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Email">
          {row.contactEmail || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Address" span={2}>
          {row.address || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Zones" span={2}>
          {zones.length ? zones.join(", ") : "—"}
        </Descriptions.Item>
      </Descriptions>
      <div>
        <Text strong>Attributes</Text>
        <div style={{ marginTop: 6 }}>
          {attrs.length ? (
            <Space wrap>
              {attrs.map(([k, v]) => (
                <Tag key={k}>
                  {k}
                  {v ? `: ${v}` : ""}
                </Tag>
              ))}
            </Space>
          ) : (
            <Paragraph type="secondary" style={{ margin: 0 }}>
              None
            </Paragraph>
          )}
        </div>
      </div>
      <div>
        <Text strong>Capabilities</Text>
        <div style={{ marginTop: 6 }}>
          {caps.length ? (
            <Space wrap>
              {caps.map((c) => (
                <Tag key={c.id} color="purple">
                  {c.productFamily}
                  {c.materials?.length
                    ? ` (${c.materials.join(", ")})`
                    : ""}
                </Tag>
              ))}
            </Space>
          ) : (
            <Paragraph type="secondary" style={{ margin: 0 }}>
              None
            </Paragraph>
          )}
        </div>
      </div>
    </Space>
  );
}

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
          description={
            "This list shows supplier_profiles and rider_profiles — not bare user roles. " +
            "Promoting a user to supplier/rider now auto-creates a pending profile so they appear here. " +
            "Then verify (and for suppliers ensure capabilities match order categories for matching)."
          }
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
                  expandable={{
                    expandedRowRender: (row) => (
                      <SupplierExpandedDetails row={row} />
                    ),
                  }}
                  columns={[
                    { title: "ID", dataIndex: "id", width: 70 },
                    {
                      title: "Business",
                      dataIndex: "businessName",
                      render: (name: string, row) => (
                        <Space>
                          {row.logoUrl ? (
                            <img
                              src={row.logoUrl}
                              alt=""
                              style={{
                                width: 28,
                                height: 28,
                                borderRadius: "50%",
                                objectFit: "cover",
                              }}
                            />
                          ) : null}
                          <span>{name}</span>
                        </Space>
                      ),
                    },
                    { title: "User", dataIndex: "userId", width: 90 },
                    {
                      title: "Contact",
                      width: 180,
                      render: (_, row) =>
                        row.contactPhone || row.contactEmail || "—",
                    },
                    {
                      title: "Attrs",
                      width: 90,
                      render: (_, row) =>
                        Object.keys(row.attributes ?? {}).length,
                    },
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
