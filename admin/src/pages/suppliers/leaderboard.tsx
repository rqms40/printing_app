import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Card,
  Col,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import { Link } from "react-router-dom";
import { List } from "@refinedev/antd";
import {
  loadSupplierLeaderboard,
  type SupplierLeaderboardRow,
} from "@/services/suppliersAdminApi";
import { rankLabel } from "@/utils/supplier-service-focus";
import { humanizeEnumValue } from "@/utils/api-normalizers";

const { Text, Title } = Typography;

function LeaderboardTable({
  title,
  metricLabel,
  rows,
  loading,
  valueRender,
}: {
  title: string;
  metricLabel: string;
  rows: SupplierLeaderboardRow[];
  loading: boolean;
  valueRender: (row: SupplierLeaderboardRow) => React.ReactNode;
}) {
  return (
    <Card title={title} size="small">
      <Table
        rowKey="supplierId"
        loading={loading}
        dataSource={rows}
        pagination={false}
        size="small"
        columns={[
          {
            title: "#",
            dataIndex: "rank",
            width: 56,
            render: (rank: number) => (
              <Tag color={rank <= 3 ? "gold" : "default"}>{rank}</Tag>
            ),
          },
          {
            title: "Supplier",
            key: "shop",
            render: (_: unknown, row: SupplierLeaderboardRow) => (
              <Space>
                <Avatar size="small" src={row.logoUrl ?? undefined}>
                  {row.businessName.charAt(0).toUpperCase()}
                </Avatar>
                <div>
                  <Link to={`/suppliers/show/${row.supplierId}`}>
                    <Text strong>{row.businessName}</Text>
                  </Link>
                  {row.topService ? (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {rankLabel(1)}: {row.topService.label}
                      </Text>
                    </div>
                  ) : null}
                </div>
              </Space>
            ),
          },
          {
            title: metricLabel,
            key: "metric",
            render: (_: unknown, row: SupplierLeaderboardRow) =>
              valueRender(row),
          },
          {
            title: "Status",
            key: "status",
            render: (_: unknown, row: SupplierLeaderboardRow) =>
              row.verificationStatus ? (
                <Tag>
                  {humanizeEnumValue(row.verificationStatus)}
                </Tag>
              ) : (
                "—"
              ),
          },
        ]}
      />
    </Card>
  );
}

export function SupplierLeaderboardPage() {
  const [reviews, setReviews] = useState<SupplierLeaderboardRow[]>([]);
  const [orders, setOrders] = useState<SupplierLeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [byReviews, byOrders] = await Promise.all([
        loadSupplierLeaderboard("reviews", 20),
        loadSupplierLeaderboard("orders", 20),
      ]);
      setReviews(byReviews);
      setOrders(byOrders);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load leaderboards");
      setReviews([]);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <List
      title="Supplier leaderboards"
      headerButtons={<Link to="/suppliers">← All profiles</Link>}
    >
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="How ranking works"
          description={
            <div>
              <div>
                <Text strong>Most reviews:</Text> highest review count, then
                average rating.
              </div>
              <div>
                <Text strong>Most orders:</Text> most assignments received, then
                accepted jobs.
              </div>
              <div style={{ marginTop: 4 }}>
                Top service is the supplier&apos;s #1 focus from onboarding.
              </div>
            </div>
          }
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

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <LeaderboardTable
              title="Most reviews"
              metricLabel="Reviews"
              rows={reviews}
              loading={loading}
              valueRender={(row) => (
                <span>
                  <Text strong>{row.ratingCount}</Text>
                  <Text type="secondary">
                    {" "}
                    · {row.ratingAverage.toFixed(1)} ★
                  </Text>
                </span>
              )}
            />
          </Col>
          <Col xs={24} lg={12}>
            <LeaderboardTable
              title="Most orders received"
              metricLabel="Orders"
              rows={orders}
              loading={loading}
              valueRender={(row) => (
                <span>
                  <Text strong>{row.ordersReceived}</Text>
                  <Text type="secondary">
                    {" "}
                    received · {row.ordersAccepted} accepted
                  </Text>
                </span>
              )}
            />
          </Col>
        </Row>

        {!loading && reviews.length === 0 && orders.length === 0 ? (
          <Card>
            <Title level={5}>No suppliers yet</Title>
            <Text type="secondary">
              When suppliers complete onboarding with service focus ranks and
              receive assignments, they will appear here.
            </Text>
          </Card>
        ) : null}
      </Space>
    </List>
  );
}
