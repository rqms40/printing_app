import { useEffect, useState } from "react";
import { Form, InputNumber, Button, Card, Spin, App } from "antd";
import { apiClient } from "@/providers/api-client";
import type { DeliverySettings } from "@/types/delivery-slot";

export function DeliverySettingsPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get<DeliverySettings>("/admin/settings/delivery")
      .then((res) => {
        form.setFieldsValue({
          serviceCenterLat: Number(res.data.serviceCenterLat),
          serviceCenterLng: Number(res.data.serviceCenterLng),
          serviceRadiusKm: Number(res.data.serviceRadiusKm),
          priorityFeeAmount: Number(res.data.priorityFeeAmount),
          extraDestinationSurcharge: Number(res.data.extraDestinationSurcharge),
        });
      })
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <Spin />;

  return (
    <Card title="Delivery Settings" style={{ maxWidth: 640 }}>
      <Form form={form} layout="vertical" onFinish={onSave}>
        <Form.Item
          name="serviceCenterLat"
          label="Service center latitude"
          rules={[{ required: true }]}
        >
          <InputNumber style={{ width: "100%" }} step={0.0001} />
        </Form.Item>
        <Form.Item
          name="serviceCenterLng"
          label="Service center longitude"
          rules={[{ required: true }]}
        >
          <InputNumber style={{ width: "100%" }} step={0.0001} />
        </Form.Item>
        <Form.Item
          name="serviceRadiusKm"
          label="Service radius (km)"
          rules={[{ required: true, type: "number", min: 0.1 }]}
        >
          <InputNumber style={{ width: "100%" }} min={0.1} />
        </Form.Item>
        <Form.Item
          name="priorityFeeAmount"
          label="Priority fee (₱)"
          rules={[{ required: true, type: "number", min: 0 }]}
        >
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>
        <Form.Item
          name="extraDestinationSurcharge"
          label="Extra destination surcharge (₱)"
          rules={[{ required: true, type: "number", min: 0 }]}
        >
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving}>
          Save settings
        </Button>
      </Form>
    </Card>
  );
}
