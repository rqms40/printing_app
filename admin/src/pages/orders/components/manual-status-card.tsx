import { useState } from "react";
import { Card, Form, Input, DatePicker, Button, Space, App } from "antd";
import dayjs from "dayjs";
import { apiClient } from "@/providers/api-client";

interface Props {
  orderId: string | number;
  initialNote: string | null;
  initialCompletionAt: string | null;
  onUpdated: () => void;
}

export function ManualStatusCard({
  orderId,
  initialNote,
  initialCompletionAt,
  onUpdated,
}: Props) {
  const { message } = App.useApp();
  const [note, setNote] = useState(initialNote ?? "");
  const [completionAt, setCompletionAt] = useState(
    initialCompletionAt ? dayjs(initialCompletionAt) : null,
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/orders/admin/orders/${orderId}/manual-status`, {
        note: note.trim() === "" ? null : note.trim(),
        estimatedCompletionAt: completionAt ? completionAt.toISOString() : null,
      });
      message.success("Manual status updated");
      onUpdated();
    } catch {
      message.error("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setSaving(true);
    try {
      await apiClient.patch(`/orders/admin/orders/${orderId}/manual-status`, {
        note: null,
        estimatedCompletionAt: null,
      });
      setNote("");
      setCompletionAt(null);
      message.success("Manual status cleared");
      onUpdated();
    } catch {
      message.error("Clear failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Manual Print Status"
      extra={
        <Button
          danger
          size="small"
          onClick={clear}
          disabled={saving || (!note && !completionAt)}
        >
          Clear
        </Button>
      }
      style={{ marginTop: 16 }}
    >
      <Form layout="vertical">
        <Form.Item label="Status note (visible to customer)">
          <Input.TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={255}
            showCount
            rows={3}
            placeholder='e.g., "Reprinting due to layer shift"'
          />
        </Form.Item>
        <Form.Item label="Estimated completion (optional)">
          <DatePicker
            showTime
            value={completionAt}
            onChange={(d) => setCompletionAt(d)}
            style={{ width: "100%" }}
          />
        </Form.Item>
        <Space>
          <Button type="primary" loading={saving} onClick={save}>
            Save status
          </Button>
        </Space>
      </Form>
    </Card>
  );
}
