import { useEffect, useMemo, useState } from "react";
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
import {
  MapContainer,
  TileLayer,
  Marker,
  Circle,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { DivIcon, type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { apiClient } from "@/providers/api-client";
import type { DeliverySettings } from "@/types/delivery-slot";

const { Text, Title } = Typography;

const PIN_ICON = new DivIcon({
  className: "delivery-pin-icon",
  html: `
    <div style="position: relative; width: 36px; height: 44px;">
      <div style="
        position: absolute;
        top: 0; left: 0;
        width: 36px; height: 36px;
        background: #FFDE58;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        border: 3px solid #141414;
      "></div>
      <div style="
        position: absolute;
        top: 9px; left: 9px;
        width: 18px; height: 18px;
        background: #141414;
        border-radius: 50%;
      "></div>
    </div>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 40],
});

function MapClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapRecenter({ center }: { center: LatLngExpression }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, map.getZoom(), { duration: 0.6 });
  }, [center, map]);
  return null;
}

export function DeliverySettingsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [center, setCenter] = useState<[number, number] | null>(null);
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
        setCenter([lat, lng]);
        setRadiusKm(radius);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleMapPick = (lat: number, lng: number) => {
    const rounded: [number, number] = [
      Number(lat.toFixed(7)),
      Number(lng.toFixed(7)),
    ];
    setCenter(rounded);
    form.setFieldsValue({
      serviceCenterLat: rounded[0],
      serviceCenterLng: rounded[1],
    });
  };

  const handleFieldChange = (
    _changed: any,
    all: { serviceCenterLat?: number; serviceCenterLng?: number; serviceRadiusKm?: number },
  ) => {
    if (typeof all.serviceCenterLat === "number" && typeof all.serviceCenterLng === "number") {
      setCenter([all.serviceCenterLat, all.serviceCenterLng]);
    }
    if (typeof all.serviceRadiusKm === "number" && all.serviceRadiusKm > 0) {
      setRadiusKm(all.serviceRadiusKm);
    }
  };

  const onSave = async (values: any) => {
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

  const tileUrl = useMemo(
    () => "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    [],
  );

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
                <MapContainer
                  center={center}
                  zoom={12}
                  style={{ height: "100%", width: "100%", zIndex: 1 }}
                >
                  <TileLayer
                    url={tileUrl}
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  />
                  <MapRecenter center={center} />
                  <MapClickHandler onPick={handleMapPick} />
                  <Marker position={center} icon={PIN_ICON} />
                  <Circle
                    center={center}
                    radius={radiusKm * 1000}
                    pathOptions={{
                      color: "#FFDE58",
                      fillColor: "#FFDE58",
                      fillOpacity: 0.12,
                      weight: 2,
                      dashArray: "6 6",
                    }}
                  />
                </MapContainer>

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

                <div
                  style={{
                    position: "absolute",
                    bottom: 12,
                    left: 12,
                    background: "rgba(20, 20, 20, 0.85)",
                    color: "#FFFFFF",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontFamily:
                      "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
                    letterSpacing: "0.04em",
                    zIndex: 2,
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <EnvironmentOutlined style={{ color: "#FFDE58" }} />
                  {center[0].toFixed(5)}, {center[1].toFixed(5)} · {radiusKm} km
                </div>
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card
              title="Service Area"
              style={{ marginBottom: 16, borderRadius: 12 }}
            >
              <Space.Compact style={{ width: "100%" }}>
                <Form.Item
                  name="serviceCenterLat"
                  label="Latitude"
                  rules={[{ required: true }]}
                  style={{ width: "50%", marginBottom: 12 }}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    step={0.0001}
                    precision={7}
                  />
                </Form.Item>
                <Form.Item
                  name="serviceCenterLng"
                  label="Longitude"
                  rules={[{ required: true }]}
                  style={{ width: "50%", marginBottom: 12 }}
                >
                  <InputNumber
                    style={{ width: "100%" }}
                    step={0.0001}
                    precision={7}
                  />
                </Form.Item>
              </Space.Compact>
              <Form.Item
                name="serviceRadiusKm"
                label="Service radius (km)"
                rules={[{ required: true, type: "number", min: 0.1 }]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0.1}
                  max={500}
                  step={1}
                />
              </Form.Item>
            </Card>

            <Card title="Fee Settings" style={{ borderRadius: 12 }}>
              <Form.Item
                name="priorityFeeAmount"
                label="Priority fee (₱)"
                rules={[{ required: true, type: "number", min: 0 }]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  step={5}
                  prefix="₱"
                />
              </Form.Item>
              <Form.Item
                name="extraDestinationSurcharge"
                label="Extra destination surcharge (₱)"
                rules={[{ required: true, type: "number", min: 0 }]}
                style={{ marginBottom: 0 }}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  step={5}
                  prefix="₱"
                />
              </Form.Item>
            </Card>

            <Divider style={{ margin: "20px 0 16px" }} />
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              block
              size="large"
            >
              Save settings
            </Button>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
