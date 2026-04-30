import { useEffect, useState } from "react";
import {
  Card, Form, Input, InputNumber, Button, Spin, App, Row, Col, Typography, Divider,
} from "antd";
import { apiClient } from "@/providers/api-client";
import type { PrinterProfile } from "@/types/printer-profile";

const { Title, Text } = Typography;

export function PrinterProfilePage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dims, setDims] = useState({ w: 180, d: 180, h: 180 });

  useEffect(() => {
    apiClient.get<PrinterProfile>("/admin/printer-profile").then((res) => {
      form.setFieldsValue({
        name: res.data.name,
        buildVolumeWidthMm: res.data.buildVolumeWidthMm,
        buildVolumeDepthMm: res.data.buildVolumeDepthMm,
        buildVolumeHeightMm: res.data.buildVolumeHeightMm,
        maxFileSizeMb: res.data.maxFileSizeMb,
      });
      setDims({
        w: res.data.buildVolumeWidthMm,
        d: res.data.buildVolumeDepthMm,
        h: res.data.buildVolumeHeightMm,
      });
      setLoading(false);
    });
  }, []);

  const onSave = async (values: any) => {
    setSaving(true);
    try {
      await apiClient.patch("/admin/printer-profile", values);
      message.success("Printer profile saved");
    } catch {
      message.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin size="large" />;

  const max = Math.max(dims.w, dims.d, dims.h);
  const scale = 180 / max;
  const W = dims.w * scale;
  const D = dims.d * scale;
  const H = dims.h * scale;

  return (
    <div style={{ maxWidth: 1100 }}>
      <Title level={3}>Printer Profile</Title>
      <Text type="secondary">
        The active printer's build volume. Customer 3D uploads exceeding these
        dimensions are blocked from checkout.
      </Text>
      <Form
        form={form}
        layout="vertical"
        onFinish={onSave}
        onValuesChange={(_, v) =>
          setDims({
            w: v.buildVolumeWidthMm ?? dims.w,
            d: v.buildVolumeDepthMm ?? dims.d,
            h: v.buildVolumeHeightMm ?? dims.h,
          })
        }
        style={{ marginTop: 24 }}
      >
        <Row gutter={24}>
          <Col xs={24} lg={14}>
            <Card title="Build Volume" style={{ borderRadius: 12, marginBottom: 16 }}>
              <Form.Item
                name="name"
                label="Printer model"
                rules={[{ required: true, max: 80 }]}
              >
                <Input placeholder="Bambu A1 Mini" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item
                    name="buildVolumeWidthMm"
                    label="Width (mm)"
                    rules={[{ required: true, type: "number", min: 1, max: 500 }]}
                  >
                    <InputNumber style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="buildVolumeDepthMm"
                    label="Depth (mm)"
                    rules={[{ required: true, type: "number", min: 1, max: 500 }]}
                  >
                    <InputNumber style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="buildVolumeHeightMm"
                    label="Height (mm)"
                    rules={[{ required: true, type: "number", min: 1, max: 500 }]}
                  >
                    <InputNumber style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card title="File Limits" style={{ borderRadius: 12 }}>
              <Form.Item
                name="maxFileSizeMb"
                label="Max file size (MB)"
                rules={[{ required: true, type: "number", min: 1, max: 500 }]}
              >
                <InputNumber style={{ width: "100%" }} />
              </Form.Item>
            </Card>

            <Divider />
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              size="large"
              block
            >
              Save profile
            </Button>
          </Col>

          <Col xs={24} lg={10}>
            <Card title="Build Volume Preview" style={{ borderRadius: 12 }}>
              <div
                style={{
                  height: 280,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  perspective: 800,
                }}
              >
                <div
                  style={{
                    transform: "rotateX(-20deg) rotateY(-25deg)",
                    transformStyle: "preserve-3d",
                    width: W,
                    height: H,
                    position: "relative",
                  }}
                >
                  {/* Front face */}
                  <div
                    style={{
                      position: "absolute",
                      width: W,
                      height: H,
                      border: "2px solid #FFDE58",
                      background: "rgba(255,222,88,0.08)",
                      transform: `translateZ(${D / 2}px)`,
                    }}
                  />
                  {/* Back face */}
                  <div
                    style={{
                      position: "absolute",
                      width: W,
                      height: H,
                      border: "2px solid #FFDE5880",
                      background: "rgba(255,222,88,0.04)",
                      transform: `translateZ(-${D / 2}px) rotateY(180deg)`,
                    }}
                  />
                  {/* Right face */}
                  <div
                    style={{
                      position: "absolute",
                      width: D,
                      height: H,
                      left: W - D / 2,
                      border: "2px solid #FFDE58",
                      background: "rgba(255,222,88,0.06)",
                      transform: `rotateY(90deg) translateZ(${D / 2}px)`,
                    }}
                  />
                  {/* Top face (dashed outline only) */}
                  <div
                    style={{
                      position: "absolute",
                      width: W,
                      height: D,
                      top: -D / 2,
                      border: "2px dashed #FFDE5880",
                      transform: `rotateX(90deg) translateZ(${D / 2}px)`,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  textAlign: "center",
                  marginTop: 12,
                  fontFamily: "monospace",
                  color: "#FFDE58",
                  fontWeight: 700,
                }}
              >
                {dims.w} × {dims.d} × {dims.h} mm
              </div>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
}
