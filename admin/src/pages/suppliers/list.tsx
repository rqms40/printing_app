import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Card,
  Input,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { Link } from "react-router-dom";
import { List } from "@refinedev/antd";
import {
  loadSupplierDirectory,
  type SupplierDirectoryRow,
} from "@/services/suppliersAdminApi";
import { rankLabel } from "@/utils/supplier-service-focus";
import { humanizeEnumValue } from "@/utils/api-normalizers";
import { formatDateTime } from "@/utils/format";

const { Text } = Typography;

const STATUS_COLOR: Record<string, string> = {
  pending: "gold",
  under_review: "blue",
  verified: "green",
  rejected: "red",
};

export function SupplierProfilesListPage() {
  const [rows, setRows] = useState<SupplierDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadSupplierDirectory();
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.businessName,
        row.description ?? "",
        row.contactEmail ?? "",
        row.address ?? "",
        ...row.rankedServices.map((s) => s.label),
        ...row.serviceZones,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [query, rows]);

  return (
    <List
      title="Supplier profiles"
      headerButtons={
        <Link to="/suppliers/leaderboard">View leaderboards →</Link>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Supplier profiling"
          description="Shop details and service focus ranks from supplier onboarding (Top 1, Top 2, …). Order and review stats power the leaderboards."
        />
        {error ? (
          <Alert
            type="error"
            showIcon
            message={error}
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
        ) : null}

        <Card size="small">
          <Input.Search
            allowClear
            placeholder="Search shop, service, zone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 360 }}
          />
        </Card>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={filtered}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: "Shop",
              key: "shop",
              render: (_: unknown, row: SupplierDirectoryRow) => (
                <Space>
                  <Avatar src={row.logoUrl ?? undefined}>
                    {row.businessName.charAt(0).toUpperCase()}
                  </Avatar>
                  <div>
                    <Link to={`/suppliers/show/${row.id}`}>
                      <Text strong>{row.businessName}</Text>
                    </Link>
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        User #{row.userId}
                        {row.updatedAt
                          ? ` · ${formatDateTime(row.updatedAt)}`
                          : ""}
                      </Text>
                    </div>
                  </div>
                </Space>
              ),
            },
            {
              title: "Top services",
              key: "services",
              render: (_: unknown, row: SupplierDirectoryRow) =>
                row.rankedServices.length === 0 ? (
                  <Text type="secondary">No focus set</Text>
                ) : (
                  <Space wrap size={[4, 4]}>
                    {row.rankedServices.slice(0, 4).map((s) => (
                      <Tag key={s.key} color={s.rank === 1 ? "blue" : "default"}>
                        {rankLabel(s.rank)}: {s.label}
                      </Tag>
                    ))}
                  </Space>
                ),
            },
            {
              title: "Reviews",
              key: "reviews",
              sorter: (a, b) => a.ratingCount - b.ratingCount,
              render: (_: unknown, row: SupplierDirectoryRow) => (
                <span>
                  {row.ratingAverage.toFixed(1)} ★ · {row.ratingCount}
                </span>
              ),
            },
            {
              title: "Orders",
              key: "orders",
              sorter: (a, b) => a.ordersReceived - b.ordersReceived,
              render: (_: unknown, row: SupplierDirectoryRow) => (
                <span>
                  {row.ordersReceived} received
                  {row.ordersAccepted > 0
                    ? ` · ${row.ordersAccepted} accepted`
                    : ""}
                </span>
              ),
            },
            {
              title: "Status",
              key: "status",
              render: (_: unknown, row: SupplierDirectoryRow) => (
                <Space wrap>
                  <Tag color={row.isActive ? "green" : "default"}>
                    {row.isActive ? "Active" : "Inactive"}
                  </Tag>
                  {row.verificationStatus ? (
                    <Tag
                      color={
                        STATUS_COLOR[row.verificationStatus] ?? "default"
                      }
                    >
                      {humanizeEnumValue(row.verificationStatus)}
                    </Tag>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </List>
  );
}
