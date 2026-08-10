import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import { List } from "@refinedev/antd";
import {
  loadAudit,
  loadPlatformHealth,
  type AuditEventRow,
  type PlatformHealth,
} from "@/services/superAdminApi";
import { formatDateTime } from "@/utils/format";

const { Text } = Typography;

export function SuperAuditPage() {
  const [items, setItems] = useState<AuditEventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [actionFilter, setActionFilter] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [audit, h] = await Promise.all([
        loadAudit({
          page,
          limit: 25,
          action: actionFilter || undefined,
        }),
        loadPlatformHealth(),
      ]);
      setItems(audit.items);
      setTotal(audit.total);
      setHealth(h);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load audit");
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const counts = health?.counts ?? {};

  return (
    <List title="Platform Health & Audit">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
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

        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="API / DB"
                value={
                  health
                    ? `${health.status} · ${health.database}`
                    : "—"
                }
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Orders" value={counts.ordersTotal ?? 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="COD recon open"
                value={counts.openCodRecon ?? 0}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Held payouts" value={counts.heldPayouts ?? 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Clients" value={counts.clients ?? 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic title="Suppliers" value={counts.suppliers ?? 0} />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="Pending supplier verif."
                value={counts.pendingSupplierVerification ?? 0}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card size="small">
              <Statistic
                title="Pending rider verif."
                value={counts.pendingRiderVerification ?? 0}
              />
            </Card>
          </Col>
        </Row>

        <Space>
          <Input
            placeholder="Filter action (e.g. role_change)"
            value={actionFilter}
            onChange={(e) => {
              setPage(1);
              setActionFilter(e.target.value.trim());
            }}
            allowClear
            style={{ width: 280 }}
          />
          <Button onClick={() => void reload()}>Refresh</Button>
        </Space>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={items}
          pagination={{
            current: page,
            pageSize: 25,
            total,
            onChange: (p) => setPage(p),
          }}
          scroll={{ x: 960 }}
          columns={[
            {
              title: "When",
              dataIndex: "createdAt",
              width: 170,
              render: (v: string) => formatDateTime(v),
            },
            {
              title: "Action",
              dataIndex: "action",
              width: 140,
              render: (v: string) => <Tag>{v}</Tag>,
            },
            {
              title: "Entity",
              render: (_, r) => (
                <Text>
                  {r.entityType}#{r.entityId}
                </Text>
              ),
            },
            {
              title: "Transition",
              render: (_, r) =>
                r.fromState || r.toState
                  ? `${r.fromState ?? "—"} → ${r.toState ?? "—"}`
                  : "—",
            },
            {
              title: "Actor",
              width: 140,
              render: (_, r) =>
                r.actorId != null
                  ? `#${r.actorId} (${r.actorRole ?? "?"})`
                  : r.actorRole ?? "system",
            },
            {
              title: "Order",
              dataIndex: "orderId",
              width: 90,
              render: (v: number | null) => v ?? "—",
            },
            {
              title: "Reason",
              dataIndex: "reason",
              ellipsis: true,
              render: (v: string | null) => v ?? "—",
            },
          ]}
        />
      </Space>
    </List>
  );
}
