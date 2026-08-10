import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  InputNumber,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { List } from "@refinedev/antd";
import {
  loadCommerceSettings,
  loadGeoZones,
  updateCommerceSettings,
  updateGeoZone,
  type CommerceSettings,
  type GeoZoneRow,
  minorToPesos,
} from "@/services/superAdminApi";

const { Text, Paragraph } = Typography;

export function SuperZonesPage() {
  const { message } = App.useApp();
  const [zones, setZones] = useState<GeoZoneRow[]>([]);
  const [commerce, setCommerce] = useState<CommerceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm();

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [z, c] = await Promise.all([
        loadGeoZones(),
        loadCommerceSettings(),
      ]);
      setZones(z);
      setCommerce(c);
      form.setFieldsValue({
        defaultCommissionBps: c.defaultCommissionBps,
        defaultDeliveryFeePesos: minorToPesos(c.defaultDeliveryFeeMinor),
        rejectOutsideZones: c.rejectOutsideZones,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load zones");
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSaveCommerce = async (values: {
    defaultCommissionBps: number;
    defaultDeliveryFeePesos: number;
    rejectOutsideZones: boolean;
  }) => {
    setSaving(true);
    try {
      const updated = await updateCommerceSettings({
        defaultCommissionBps: values.defaultCommissionBps,
        defaultDeliveryFeeMinor: String(
          Math.round(values.defaultDeliveryFeePesos * 100),
        ),
        rejectOutsideZones: values.rejectOutsideZones,
      });
      setCommerce(updated);
      message.success("Commerce settings saved");
    } catch {
      message.error("Failed to save commerce settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleZone = async (zone: GeoZoneRow, isActive: boolean) => {
    try {
      await updateGeoZone(zone.id, { isActive });
      message.success(`${zone.name} ${isActive ? "enabled" : "disabled"}`);
      await reload();
    } catch {
      message.error("Failed to update zone");
    }
  };

  return (
    <List title="Service Zones & Fees">
      <Space direction="vertical" size="middle" style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="Davao pilot zones"
          description="Simplified polygon zones. When reject-outside-zones is on, delivery checkout outside all active zones is refused."
        />
        {error ? (
          <Alert type="error" showIcon message={error} />
        ) : null}

        <Card title="Platform commission & default delivery fee" loading={loading}>
          <Form form={form} layout="vertical" onFinish={onSaveCommerce}>
            <Space wrap size="large" align="start">
              <Form.Item
                name="defaultCommissionBps"
                label="Commission (basis points)"
                extra="1500 = 15%"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} max={10000} style={{ width: 160 }} />
              </Form.Item>
              <Form.Item
                name="defaultDeliveryFeePesos"
                label="Default delivery fee (₱)"
                rules={[{ required: true }]}
              >
                <InputNumber min={0} step={1} style={{ width: 160 }} />
              </Form.Item>
              <Form.Item
                name="rejectOutsideZones"
                label="Reject outside zones"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
              <Form.Item label=" ">
                <Button type="primary" htmlType="submit" loading={saving}>
                  Save settings
                </Button>
              </Form.Item>
            </Space>
          </Form>
          {commerce ? (
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              Current commission: {(commerce.defaultCommissionBps / 100).toFixed(2)}% ·
              Default fee: ₱{minorToPesos(commerce.defaultDeliveryFeeMinor).toFixed(2)}
            </Paragraph>
          ) : null}
        </Card>

        <Card title="Geo zones">
          <Table
            rowKey="id"
            loading={loading}
            dataSource={zones}
            pagination={false}
            columns={[
              { title: "Name", dataIndex: "name" },
              { title: "Code", dataIndex: "code", width: 160 },
              {
                title: "Base fee",
                dataIndex: "baseDeliveryFeeMinor",
                width: 120,
                render: (v: string) => `₱${minorToPesos(v).toFixed(2)}`,
              },
              {
                title: "Active",
                dataIndex: "isActive",
                width: 100,
                render: (v: boolean, row) => (
                  <Switch
                    checked={v}
                    onChange={(checked) => void toggleZone(row, checked)}
                  />
                ),
              },
              {
                title: "Polygon",
                render: (_, row) => (
                  <Tag>
                    {row.polygon?.coordinates?.[0]?.length ?? 0} vertices
                  </Tag>
                ),
              },
            ]}
          />
          <Text type="secondary" style={{ display: "block", marginTop: 12 }}>
            Seeded: Davao City Core + Toril. Edit polygons via API or future map
            editor; list/toggle is sufficient for pilot governance.
          </Text>
        </Card>
      </Space>
    </List>
  );
}
