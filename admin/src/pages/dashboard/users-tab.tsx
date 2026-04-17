import { useEffect, useState, type ReactNode } from "react";
import { Alert, Button, Card, Col, Empty, Radio, Row, Spin, Space, Typography } from "antd";
import {
  UserOutlined,
  UserAddOutlined,
  CheckCircleOutlined,
  ProfileOutlined,
} from "@ant-design/icons";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  buildUsersAnalyticsViewModel,
  loadAdminUsersAnalytics,
  type AdminUsersAnalyticsPoint,
  type AdminUsersAnalyticsRecord,
  type DashboardUsersAnalyticsPeriod,
} from "./users-analytics";

const { Title, Text } = Typography;

const cardStyle = { background: "#1f1f1f", border: "1px solid #2E2E2E", borderRadius: 12 };
const tooltipStyle = {
  backgroundColor: "#1f1f1f",
  borderColor: "#2E2E2E",
  borderRadius: 8,
  color: "#F0F0F0",
};

function formatValue(value: number) {
  return value.toLocaleString();
}

function renderEmptyState(message: string, height = 240) {
  return (
    <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={<span style={{ color: "#808080" }}>{message}</span>}
      />
    </div>
  );
}

function PeriodControl({
  period,
  onChange,
}: {
  period: DashboardUsersAnalyticsPeriod;
  onChange: (next: DashboardUsersAnalyticsPeriod) => void;
}) {
  return (
    <Radio.Group
      value={period}
      onChange={(event) => onChange(event.target.value)}
      size="small"
      buttonStyle="solid"
    >
      {(["7D", "30D", "6M"] as const).map((option, index, options) => (
        <Radio.Button
          key={option}
          value={option}
          style={{
            background: period === option ? "#F0F0F0" : "#141414",
            color: period === option ? "#141414" : "#808080",
            borderColor: period === option ? "#F0F0F0" : "#2E2E2E",
            borderRadius:
              index === 0
                ? "16px 0 0 16px"
                : index === options.length - 1
                  ? "0 16px 16px 0"
                  : undefined,
            padding: "0 16px",
          }}
        >
          {option}
        </Radio.Button>
      ))}
    </Radio.Group>
  );
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <Card style={cardStyle} styles={{ body: { padding: 18 } }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Title level={3} style={{ color: "#F0F0F0", margin: "0 0 4px 0" }}>
            {value}
          </Title>
          <Text style={{ color: "#808080", fontSize: 13 }}>{label}</Text>
        </div>
        <div style={{ background: "rgba(255,255,255,0.08)", padding: 10, borderRadius: 10 }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function MetricListCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: AdminUsersAnalyticsPoint[];
  emptyLabel: string;
}) {
  return (
    <Card
      title={<Text style={{ color: "#F0F0F0", fontWeight: 600 }}>{title}</Text>}
      style={cardStyle}
      styles={{ header: { borderBottom: "1px solid #2E2E2E" } }}
    >
      {items.length === 0 ? (
        renderEmptyState(emptyLabel, 180)
      ) : (
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          {items.slice(0, 5).map((item) => (
            <div
              key={item.label}
              style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
            >
              <Text style={{ color: "#BDBDBD" }}>{item.label}</Text>
              <Text style={{ color: "#F0F0F0", fontWeight: 600 }}>{formatValue(item.value)}</Text>
            </div>
          ))}
        </Space>
      )}
    </Card>
  );
}

function TrendChartCard({
  title,
  data,
}: {
  title: string;
  data: AdminUsersAnalyticsPoint[];
}) {
  return (
    <Card
      title={<Text style={{ color: "#F0F0F0", fontWeight: 600 }}>{title}</Text>}
      style={cardStyle}
      styles={{ header: { borderBottom: "1px solid #2E2E2E" } }}
    >
      {data.length === 0 ? (
        renderEmptyState("No trend data yet")
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="usersSignupFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#42A5F5" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#42A5F5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
            <XAxis dataKey="label" stroke="#555" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke="#42A5F5" strokeWidth={2.5} fill="url(#usersSignupFill)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function MixChartCard({
  title,
  data,
  emptyLabel,
  color,
}: {
  title: string;
  data: AdminUsersAnalyticsPoint[];
  emptyLabel: string;
  color: string;
}) {
  return (
    <Card
      title={<Text style={{ color: "#F0F0F0", fontWeight: 600 }}>{title}</Text>}
      style={cardStyle}
      styles={{ header: { borderBottom: "1px solid #2E2E2E" } }}
    >
      {data.length === 0 ? (
        renderEmptyState(emptyLabel)
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data.slice(0, 6)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2E2E2E" />
            <XAxis dataKey="label" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#555" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function ReadyState({ analytics }: { analytics: AdminUsersAnalyticsRecord }) {
  return (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} lg={6}>
          <KpiCard
            label="Total Customers"
            value={formatValue(analytics.summary.total_customers)}
            icon={<UserOutlined style={{ color: "#42A5F5", fontSize: 20 }} />}
          />
        </Col>
        <Col xs={12} lg={6}>
          <KpiCard
            label="New Customers"
            value={formatValue(analytics.summary.new_customers)}
            icon={<UserAddOutlined style={{ color: "#FFCA28", fontSize: 20 }} />}
          />
        </Col>
        <Col xs={12} lg={6}>
          <KpiCard
            label="Active Customers"
            value={formatValue(analytics.summary.active_customers)}
            icon={<CheckCircleOutlined style={{ color: "#34d399", fontSize: 20 }} />}
          />
        </Col>
        <Col xs={12} lg={6}>
          <KpiCard
            label="Profile Completion Rate"
            value={`${analytics.summary.profile_completion_rate}%`}
            icon={<ProfileOutlined style={{ color: "#FFDE58", fontSize: 20 }} />}
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={8}>
          <Card
            title={<Text style={{ color: "#F0F0F0", fontWeight: 600 }}>Role Distribution</Text>}
            style={cardStyle}
            styles={{ header: { borderBottom: "1px solid #2E2E2E" } }}
          >
            <Space direction="vertical" size={14} style={{ width: "100%" }}>
              {[
                ["Customers", analytics.summary.role_counts.customers],
                ["Drivers", analytics.summary.role_counts.drivers],
                ["Admins", analytics.summary.role_counts.admins],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ color: "#BDBDBD" }}>{label}</Text>
                  <Text style={{ color: "#F0F0F0", fontWeight: 600 }}>{formatValue(Number(value))}</Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <TrendChartCard title="Signup Trend" data={analytics.signup_trend} />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <MixChartCard
            title="Profile Category Mix"
            data={analytics.profile_category_mix}
            emptyLabel="No profile category data yet"
            color="#42A5F5"
          />
        </Col>
        <Col xs={24} lg={12}>
          <MixChartCard
            title="Profile Field Mix"
            data={analytics.profile_field_mix}
            emptyLabel="No profile field data yet"
            color="#FFCA28"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <MixChartCard
            title="Preference Mix"
            data={analytics.preference_mix}
            emptyLabel="No preference data yet"
            color="#34d399"
          />
        </Col>
        <Col xs={24} lg={12}>
          <MetricListCard
            title="Activity Split"
            items={analytics.activity_split}
            emptyLabel="No activity split yet"
          />
        </Col>
      </Row>
    </>
  );
}

export function UsersTab() {
  const [period, setPeriod] = useState<DashboardUsersAnalyticsPeriod>("7D");
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState({
    loading: true,
    analytics: null as AdminUsersAnalyticsRecord | null,
    error: null as string | null,
  });

  useEffect(() => {
    let active = true;

    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    void loadAdminUsersAnalytics(period)
      .then((analytics) => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          analytics,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setState({
          loading: false,
          analytics: null,
          error: error instanceof Error ? error.message : "Unable to load users analytics",
        });
      });

    return () => {
      active = false;
    };
  }, [period, reloadToken]);

  const view = buildUsersAnalyticsViewModel(state);

  return (
    <div style={{ paddingBottom: 8 }}>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <Title level={4} style={{ color: "#F0F0F0", margin: 0 }}>
            Users
          </Title>
          <Text style={{ color: "#808080", fontSize: 13 }}>
            Customer growth, profile mix, and activity signals
          </Text>
        </div>
        <PeriodControl period={period} onChange={setPeriod} />
      </div>

      {view.kind === "loading" ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <Spin size="large" />
        </div>
      ) : null}

      {view.kind === "error" ? (
        <Alert
          type="error"
          message={view.message}
          action={
            <Button size="small" onClick={() => setReloadToken((value) => value + 1)}>
              {view.retryLabel}
            </Button>
          }
          style={{ background: "#2a1215", borderColor: "#58181c", color: "#F0F0F0" }}
        />
      ) : null}

      {view.kind === "ready" ? <ReadyState analytics={view.analytics} /> : null}
    </div>
  );
}
