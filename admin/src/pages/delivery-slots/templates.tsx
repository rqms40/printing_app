import { useEffect, useState } from "react";
import { Table, Button, Drawer, Form, Input, InputNumber, Switch, App } from "antd";
import { apiClient } from "@/providers/api-client";
import type { DeliverySlotTemplate } from "@/types/delivery-slot";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DeliverySlotTemplatesPage() {
  const { message } = App.useApp();
  const [templates, setTemplates] = useState<DeliverySlotTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<DeliverySlotTemplate | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm();

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<DeliverySlotTemplate[]>(
        "/admin/delivery-slot-templates"
      );
      setTemplates(res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onSave = async (values: any) => {
    try {
      if (editing) {
        await apiClient.patch(`/admin/delivery-slot-templates/${editing.id}`, values);
        message.success("Slot template updated");
      } else {
        await apiClient.post("/admin/delivery-slot-templates", values);
        message.success("Slot template created");
      }
      setDrawerOpen(false);
      setEditing(null);
      form.resetFields();
      refresh();
    } catch (err: any) {
      message.error(err?.response?.data?.message || "Save failed");
    }
  };

  const onDelete = async (id: number) => {
    await apiClient.delete(`/admin/delivery-slot-templates/${id}`);
    refresh();
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <h2>Delivery Slot Templates</h2>
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            setDrawerOpen(true);
          }}
        >
          Add slot
        </Button>
      </div>

      <Table
        dataSource={templates}
        rowKey="id"
        loading={loading}
        pagination={false}
        columns={[
          {
            title: "Day",
            dataIndex: "dayOfWeek",
            render: (v: number) => DAY_NAMES[v],
          },
          { title: "Start", dataIndex: "startTime" },
          { title: "End", dataIndex: "endTime" },
          { title: "Capacity", dataIndex: "capacity" },
          {
            title: "Active",
            dataIndex: "isActive",
            render: (v: boolean) => (v ? "Yes" : "No"),
          },
          {
            title: "Actions",
            render: (_: unknown, record: DeliverySlotTemplate) => (
              <>
                <Button
                  size="small"
                  onClick={() => {
                    setEditing(record);
                    form.setFieldsValue(record);
                    setDrawerOpen(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  danger
                  style={{ marginLeft: 8 }}
                  onClick={() => onDelete(record.id)}
                >
                  Delete
                </Button>
              </>
            ),
          },
        ]}
      />

      <Drawer
        title={editing ? "Edit slot template" : "New slot template"}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        width={400}
      >
        <Form form={form} layout="vertical" onFinish={onSave}>
          <Form.Item
            name="dayOfWeek"
            label="Day of week (0=Sun, 6=Sat)"
            rules={[{ required: true }]}
          >
            <InputNumber min={0} max={6} />
          </Form.Item>
          <Form.Item name="startTime" label="Start time" rules={[{ required: true }]}>
            <Input placeholder="09:30" />
          </Form.Item>
          <Form.Item name="endTime" label="End time" rules={[{ required: true }]}>
            <Input placeholder="11:30" />
          </Form.Item>
          <Form.Item name="capacity" label="Capacity" rules={[{ required: true }]}>
            <InputNumber min={1} max={50} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Save
          </Button>
        </Form>
      </Drawer>
    </div>
  );
}
