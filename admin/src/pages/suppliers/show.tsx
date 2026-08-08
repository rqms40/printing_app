import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Card,
  Descriptions,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { Link, useParams } from "react-router-dom";
import { ShowPage } from "@/components/show-page";
import {
  loadSupplierDirectory,
  loadSupplierProfile,
  type SupplierDirectoryRow,
} from "@/services/suppliersAdminApi";
import { rankLabel } from "@/utils/supplier-service-focus";
import { humanizeEnumValue } from "@/utils/api-normalizers";
import { formatDateTime } from "@/utils/format";

const { Paragraph, Text, Title } = Typography;

const STATUS_COLOR: Record<string, string> = {
  pending: "gold",
  under_review: "blue",
  verified: "green",
  rejected: "red",
};

export function SupplierProfileShowPage() {
  const { id } = useParams<{ id: string }>();
  const supplierId = Number(id);
  const [row, setRow] = useState<SupplierDirectoryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      setError("Invalid supplier id");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Prefer directory row (includes order stats); fall back to raw profile.
      const directory = await loadSupplierDirectory();
      const fromDir = directory.find((d) => d.id === supplierId) ?? null;
      if (fromDir) {
        setRow(fromDir);
      } else {
        setRow(await loadSupplierProfile(supplierId));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load profile");
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) {
    return (
      <ShowPage title="Supplier profile" backTo="/suppliers" contentCard={false}>
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <Spin size="large" />
        </div>
      </ShowPage>
    );
  }

  if (error || !row) {
    return (
      <ShowPage title="Supplier profile" backTo="/suppliers">
        <Alert
          type="error"
          showIcon
          message={error ?? "Supplier not found"}
          action={
            <a
              href="#retry"
              onClick={(e) => {
                e.preventDefault();
                void reload();
              }}
            >
              Retry
            </a>
          }
        />
      </ShowPage>
    );
  }

  return (
    <ShowPage
      title={row.businessName}
      backTo="/suppliers"
      contentCard={false}
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Card
          extra={
            <Space>
              <Link to={`/users/show/${row.userId}`}>User #{row.userId}</Link>
              <Link to="/suppliers/leaderboard">Leaderboards</Link>
            </Space>
          }
        >
          <Space align="start" size="large" wrap>
            <Avatar size={80} src={row.logoUrl ?? undefined}>
              {row.businessName.charAt(0).toUpperCase()}
            </Avatar>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {row.businessName}
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                {row.description ?? "No description provided"}
              </Paragraph>
              <Space wrap>
                <Tag color={row.isActive ? "green" : "default"}>
                  {row.isActive ? "Active" : "Inactive"}
                </Tag>
                {row.verificationStatus ? (
                  <Tag
                    color={STATUS_COLOR[row.verificationStatus] ?? "default"}
                  >
                    {humanizeEnumValue(row.verificationStatus)}
                  </Tag>
                ) : null}
                <Tag>
                  {row.ratingAverage.toFixed(1)} ★ ({row.ratingCount} reviews)
                </Tag>
                <Tag color="blue">
                  {row.ordersReceived} orders received
                </Tag>
              </Space>
            </div>
          </Space>
        </Card>

        <Card title="Service focus (from onboarding)">
          {row.rankedServices.length === 0 ? (
            <Text type="secondary">
              No service focus ranks yet. Suppliers set these during sign-up or
              in service-focus settings.
            </Text>
          ) : (
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {row.rankedServices.map((s) => (
                <div
                  key={s.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 12px",
                    border: "1px solid #303030",
                    borderRadius: 8,
                    background: s.rank === 1 ? "#111a2c" : "#1f1f1f",
                  }}
                >
                  <Tag color={s.rank === 1 ? "blue" : "default"}>
                    {rankLabel(s.rank)}
                  </Tag>
                  <Text strong={s.rank === 1}>{s.label}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    ({s.key})
                  </Text>
                </div>
              ))}
            </Space>
          )}
        </Card>

        <Card title="Shop details">
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Contact phone">
              {row.contactPhone ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Contact email">
              {row.contactEmail ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Address" span={2}>
              {row.address ?? "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Service zones" span={2}>
              {row.serviceZones.length
                ? row.serviceZones.join(", ")
                : "—"}
            </Descriptions.Item>
            <Descriptions.Item label="Orders received">
              {row.ordersReceived}
            </Descriptions.Item>
            <Descriptions.Item label="Orders accepted">
              {row.ordersAccepted}
            </Descriptions.Item>
            <Descriptions.Item label="Updated" span={2}>
              {row.updatedAt ? formatDateTime(row.updatedAt) : "—"}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Capabilities">
          {row.capabilities.length === 0 ? (
            <Text type="secondary">No capabilities listed</Text>
          ) : (
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
              {row.capabilities.map((cap) => (
                <div key={cap.id}>
                  <Tag color="purple">{cap.productFamily}</Tag>
                  <Text type="secondary" style={{ marginLeft: 8 }}>
                    {cap.materials.length
                      ? cap.materials.join(", ")
                      : "No materials"}
                    {cap.maxCapacity > 0
                      ? ` · capacity ${cap.maxCapacity}`
                      : ""}
                    {cap.leadTimeDays > 0
                      ? ` · lead ${cap.leadTimeDays}d`
                      : ""}
                  </Text>
                </div>
              ))}
            </Space>
          )}
        </Card>
      </Space>
    </ShowPage>
  );
}
