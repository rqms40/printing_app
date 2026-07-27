import { useEffect, useState } from "react";
import {
  Form,
  InputNumber,
  Button,
  Card,
  Spin,
  App,
  Row,
  Col,
  Typography,
  Space,
  Divider,
} from "antd";
import { EnvironmentOutlined, AimOutlined } from "@ant-design/icons";
import { apiClient } from "@/providers/api-client";
import type { DeliverySettings } from "@/types/delivery-slot";
import { GridGoogleMap } from "@/components/google-map/grid-google-map";

const { Text, Title } = Typography;

export function DeliverySettingsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [radiusKm, setRadiusKm] = useState<number>(25);

  useEffect(() => {
    apiClient
      .get<DeliverySettings>("/admin/settings/delivery")
      .then((res) => {
        const lat = Number(res.data.serviceCenterLat);
        const lng = Number(res.data.serviceCenterLng);
        const radius = Number(res.data.serviceRadiusKm);
        form.setFieldsValue({
          serviceCenterLat: lat,
          serviceCenterLng: lng,
          serviceRadiusKm: radius,
          priorityFeeAmount: Number(res.data.priorityFeeAmount),
          extraDestinationSurcharge: Number(res.data.extraDestinationSurcharge),
        });
        setCenter({ lat, lng });
        setRadiusKm(radius);
      })
      .finally(() => setLoading(false));
  }, [form]);

  const handleMapPick = (lat: number, lng: number) => {
    const next = {
      lat: Number(lat.toFixed(7)),
      lng: Number(lng.toFixed(7)),
    };
    setCenter(next);
    form.setFieldsValue({
      serviceCenterLat: next.lat,
      serviceCenterLng: next.lng,
    });
  };

  const handleFieldChange = (
    _changed: unknown,
    all: {
      serviceCenterLat?: number;
      serviceCenterLng?: number;
      serviceRadiusKm?: number;
    },
  ) => {
    if (
      typeof all.serviceCenterLat === "number" &&
      typeof all.serviceCenterLng === "number"
    ) {
      setCenter({ lat: all.serviceCenterLat, lng: all.serviceCenterLng });
    }
    if (typeof all.serviceRadiusKm === "number" && all.serviceRadiusKm > 0) {
      setRadiusKm(all.serviceRadiusKm);
    }
  };

  const onSave = async (values: unknown) => {
    setSaving(true);
    try {
      await apiClient.patch("/admin/settings/delivery", values);
      message.success("Delivery settings saved");
    } catch {
      message.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !center) {
    return (
      <div style={{ padding: 48, display: "flex", justifyContent: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      <Title level={3} style={{ marginBottom: 4 }}>
        Delivery Settings
      </Title>
      <Text type="secondary">
        Click on the map to set the service center. The yellow circle shows the
        delivery radius — addresses inside the circle are local; outside go to
        external courier handoff.
      </Text>

      <Form
        form={form}
        layout="vertical"
        onFinish={onSave}
        onValuesChange={handleFieldChange}
        style={{ marginTop: 24 }}
      >
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <Card
              styles={{
                body: { padding: 0, overflow: "hidden", borderRadius: 12 },
              }}
              style={{ borderRadius: 12, overflow: "hidden" }}
            >
              <div style={{ height: 480, position: "relative" }}>
                <GridGoogleMap
                  center={center}
                  zoom={12}
                  height={480}
                  interactive
                  onClick={(pos) => handleMapPick(pos.lat, pos.lng)}
                  markers={[
                    {
                      id: "service-center",
                      position: center,
                      title: "Service center",
                    },
                  ]}
                  circles={[
                    {
                      id: "service-radius",
                      center,
                      radiusMeters: radiusKm * 1000,
                      strokeColor: "#FFDE58",
                      fillColor: "#FFDE58",
                    },
                  ]}
                  fitPositions={[center]}
                />

                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    background: "rgba(20, 20, 20, 0.85)",
                    color: "#FFFFFF",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 500,
                    zIndex: 2,
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    pointerEvents: "none",
                  }}
                >
                  <AimOutlined style={{ color: "#FFDE58" }} />
                  Click anywhere on the map to move the service center
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card title={<Space><EnvironmentOutlined /> Service area</Space>}>
              <Form.Item
                label="Center latitude"
                name="serviceCenterLat"
                rules={[{ required: true }]}
              >
                <InputNumber style={{ width: "100%" }} step={0.0000001} />
              </Form.Item>
              <Form.Item
                label="Center longitude"
                name="serviceCenterLng"
                rules={[{ required: true }]}
              >
                <InputNumber style={{ width: "100%" }} step={0.0000001} />
              </Form.Item>
              <Form.Item
                label="Radius (km)"
                name="serviceRadiusKm"
                rules={[{ required: true }]}
              >
                <InputNumber style={{ width: "100%" }} min={1} max={200} />
              </Form.Item>
              <Divider />
              <Form.Item label="Priority fee (PHP)" name="priorityFeeAmount">
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
              <Form.Item
                label="Extra destination surcharge (PHP)"
                name="extraDestinationSurcharge"
              >
                <InputNumber style={{ width: "100%" }} min={0} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={saving} block>
                Save delivery settings
              </Button>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}

export default DeliverySettingsPage;
