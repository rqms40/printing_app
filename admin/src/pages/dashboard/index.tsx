import { Row, Col, Card, Typography } from "antd";
import {
  ShoppingCartOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  CarOutlined,
  DollarOutlined,
} from "@ant-design/icons";
import { KpiCard } from "@/components/kpi-card";
import { formatCurrency } from "@/utils/format";
import { mockKPIs, mockSalesData, mockVolumeData } from "@/providers/mock-data";
import { Line, Column } from "@ant-design/charts";

const { Title } = Typography;

export function DashboardPage() {
  const kpis = mockKPIs;
  const salesData = mockSalesData;
  const volumeData = mockVolumeData;

  const lineConfig = {
    data: salesData,
    xField: "month",
    yField: "value",
    color: "#FFDE58",
    smooth: true,
    height: 300,
    theme: "classicDark",
    axis: {
      y: { labelFormatter: (v: number) => `₱${(v / 1000).toFixed(0)}k` },
    },
  };

  const barConfig = {
    data: volumeData,
    xField: "month",
    yField: "value",
    color: "#5B5B5B",
    height: 300,
    theme: "classicDark",
    style: {
      radiusTopLeft: 4,
      radiusTopRight: 4,
    },
  };

  return (
    <div>
      <Title level={3} style={{ color: "#F0F0F0", marginBottom: 24 }}>
        Dashboard
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <KpiCard
            title="New Orders"
            value={kpis.new_orders_count}
            prefix={<ShoppingCartOutlined />}
            color="#42A5F5"
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard
            title="In Production"
            value={kpis.in_production_count}
            prefix={<ToolOutlined />}
            color="#FFCA28"
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard
            title="Ready for Pickup"
            value={kpis.ready_for_pickup_count}
            prefix={<CheckCircleOutlined />}
            color="#66BB6A"
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard
            title="Delivered"
            value={kpis.delivered_count}
            prefix={<CarOutlined />}
            color="#66BB6A"
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <KpiCard
            title="Monthly Revenue"
            value={formatCurrency(kpis.monthly_revenue)}
            prefix={<DollarOutlined />}
            color="#FFDE58"
          />
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title="Sales Trend (6 months)" style={{ background: "#141414" }}>
            <Line {...lineConfig} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Order Volume (6 months)" style={{ background: "#141414" }}>
            <Column {...barConfig} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
