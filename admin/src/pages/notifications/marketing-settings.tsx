import { useState } from "react";
import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Card,
  Row,
  Col,
  List,
  Typography,
  Space,
  theme,
  message,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useCustom, useCustomMutation } from "@refinedev/core";
import { GridLogo } from "@/components/grid-logo";

const { Text, Title } = Typography;
const { TextArea } = Input;

type IntervalUnit = "days" | "weeks" | "months";

interface FrequencyFormValues {
  intervalCount?: number;
  intervalUnit?: IntervalUnit;
}

interface MarketingNotification {
  id: number;
  description: string;
  header: string;
  body: string;
  frequency: string;
  isActive: boolean;
}

const unitSuffixByIntervalUnit: Record<IntervalUnit, string> = {
  days: "d",
  weeks: "w",
  months: "m",
};

const intervalUnitBySuffix: Record<string, IntervalUnit> = {
  d: "days",
  w: "weeks",
  m: "months",
};

const intervalUnitLabels: Record<IntervalUnit, string> = {
  days: "day",
  weeks: "week",
  months: "month",
};

function normalizeIntervalCount(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, Math.floor(numeric));
}

export function parseFrequencyValue(
  frequency?: string,
): Required<FrequencyFormValues> {
  if (frequency === "monthly") {
    return { intervalCount: 1, intervalUnit: "months" };
  }

  const match = frequency?.match(/^(\d+)([dwm])$/);
  if (match) {
    return {
      intervalCount: normalizeIntervalCount(match[1]),
      intervalUnit: intervalUnitBySuffix[match[2]],
    };
  }

  return { intervalCount: 1, intervalUnit: "days" };
}

export function buildFrequencyValue(values: FrequencyFormValues): string {
  const intervalUnit = values.intervalUnit ?? "days";
  return `${normalizeIntervalCount(values.intervalCount)}${unitSuffixByIntervalUnit[intervalUnit]}`;
}

function pluralizeUnit(count: number, unit: IntervalUnit): string {
  const label = intervalUnitLabels[unit];
  return count === 1 ? label : `${label}s`;
}

export function formatFrequencyLabel(frequency?: string): string {
  if (!frequency) return "Not scheduled";
  if (frequency === "6h") return "Every 6 hours";
  if (frequency === "daily") return "Every day";
  if (frequency === "monthly") return "Every month";

  if (!/^(\d+)([dwm])$/.test(frequency)) return frequency;

  const parsed = parseFrequencyValue(frequency);
  return parsed.intervalCount === 1
    ? `Every ${pluralizeUnit(parsed.intervalCount, parsed.intervalUnit)}`
    : `Every ${parsed.intervalCount} ${pluralizeUnit(
        parsed.intervalCount,
        parsed.intervalUnit,
      )}`;
}

function formatScheduleSentence(values: FrequencyFormValues): string {
  const label = formatFrequencyLabel(buildFrequencyValue(values));
  return `Runs ${label.charAt(0).toLowerCase()}${label.slice(1)}.`;
}

export function MarketingSettings() {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [previewHeader, setPreviewHeader] = useState("Plane Available");
  const [previewBody, setPreviewBody] = useState(
    "The plane you requested will be fueled and ready at 1pm",
  );
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useCustom<MarketingNotification[]>({
    url: "/notifications/marketing",
    method: "get",
  });

  const { mutate } = useCustomMutation<MarketingNotification>();

  const notifications = data?.data || [];
  const intervalCount = Form.useWatch("intervalCount", form) ?? 1;
  const intervalUnit = Form.useWatch("intervalUnit", form) ?? "days";

  const handleValuesChange = (_changedValues: any, allValues: any) => {
    if (allValues.header !== undefined) setPreviewHeader(allValues.header);
    if (allValues.body !== undefined) setPreviewBody(allValues.body);
  };

  const onEdit = (record: MarketingNotification) => {
    const frequencyValues = parseFrequencyValue(record.frequency);
    setEditingId(record.id);
    form.setFieldsValue({ ...record, ...frequencyValues });
    setPreviewHeader(record.header);
    setPreviewBody(record.body);
  };

  const resetForm = () => {
    setEditingId(null);
    form.resetFields();
    setPreviewHeader("Header Preview");
    setPreviewBody("Body Preview");
  };

  const onFinish = (values: any) => {
    const { intervalCount, intervalUnit, ...rest } = values;
    const payload = {
      ...rest,
      frequency: buildFrequencyValue({ intervalCount, intervalUnit }),
    };

    if (editingId) {
      mutate(
        {
          url: `/notifications/marketing/${editingId}`,
          method: "patch",
          values: payload,
        },
        {
          onSuccess: () => {
            message.success("Marketing notification updated");
            refetch();
            resetForm();
          },
        }
      );
    } else {
      mutate(
        {
          url: "/notifications/marketing",
          method: "post",
          values: payload,
        },
        {
          onSuccess: () => {
            message.success("Marketing notification created");
            refetch();
            resetForm();
          },
        }
      );
    }
  };

  const onDelete = (id: number) => {
    mutate(
      {
        url: `/notifications/marketing/${id}`,
        method: "delete",
        values: {},
      },
      {
        onSuccess: () => {
          message.success("Marketing notification deleted");
          refetch();
          if (editingId === id) resetForm();
        },
      }
    );
  };

  return (
    <Row gutter={[24, 24]}>
      <Col xs={24} lg={12}>
        <Card
          title="Marketing Notifications"
          extra={
            <Button icon={<PlusOutlined />} onClick={resetForm}>
              New
            </Button>
          }
        >
          <List
            loading={isLoading}
            dataSource={notifications}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => onEdit(item)}
                  />,
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => onDelete(item.id)}
                  />,
                ]}
              >
                <List.Item.Meta
                  title={item.description || item.header}
                  description={`Frequency: ${formatFrequencyLabel(
                    item.frequency,
                  )} | Active: ${item.isActive ? "Yes" : "No"}`}
                />
              </List.Item>
            )}
          />
        </Card>
      </Col>

      <Col xs={24} lg={12}>
        <Card title={editingId ? "Edit Notification" : "Create Notification"}>
          <Form
            form={form}
            layout="vertical"
            onValuesChange={handleValuesChange}
            onFinish={onFinish}
            initialValues={{
              intervalCount: 1,
              intervalUnit: "days",
              isActive: true,
            }}
          >
            <Form.Item
              name="description"
              label="Customized Description (Admin Only)"
            >
              <Input placeholder="e.g., Summer Promo Reminder" />
            </Form.Item>

            <Form.Item
              name="header"
              label="Notification Header"
              rules={[{ required: true }]}
            >
              <Input placeholder="e.g., Plane Available" />
            </Form.Item>

            <Form.Item
              name="body"
              label="Notification Body"
              rules={[{ required: true }]}
            >
              <TextArea rows={3} placeholder="e.g., The plane you requested..." />
            </Form.Item>

            <Row gutter={12}>
              <Col xs={24} sm={10}>
                <Form.Item
                  name="intervalCount"
                  label="Repeat every"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} precision={0} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={14}>
                <Form.Item
                  name="intervalUnit"
                  label="Interval unit"
                  rules={[{ required: true }]}
                >
                  <Select>
                    <Select.Option value="days">Days</Select.Option>
                    <Select.Option value="weeks">Weeks</Select.Option>
                    <Select.Option value="months">Months</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Text
              type="secondary"
              style={{ display: "block", marginTop: -12, marginBottom: 16 }}
            >
              {formatScheduleSentence({ intervalCount, intervalUnit })}
            </Text>

            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  Save Changes
                </Button>
                {editingId && (
                  <Button onClick={resetForm}>Cancel</Button>
                )}
              </Space>
            </Form.Item>
          </Form>

          {/* iOS Style Preview Box */}
          <div style={{ marginTop: 24 }}>
            <Title level={5}>Live Preview</Title>
              <div
                style={{
                  background: token.colorBgLayout,
                  padding: "24px",
                borderRadius: "16px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              {/* Notification Bubble */}
              <div
                style={{
                  background: token.colorBgElevated,
                  borderRadius: "16px",
                  padding: "16px",
                  width: "100%",
                  maxWidth: "350px",
                  boxShadow: token.boxShadowSecondary,
                  border: `1px solid ${token.colorBorderSecondary}`
                }}
              >
                <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
                  <div style={{
                    background: token.colorPrimary,
                    borderRadius: "4px",
                    width: "20px",
                    height: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: "8px"
                  }}>
                    <GridLogo size={12} />
                  </div>
                  <Text type="secondary" style={{ fontSize: "12px", flex: 1 }}>GRID PRINT</Text>
                  <Text type="secondary" style={{ fontSize: "12px" }}>now</Text>
                </div>
                <div>
                  <Text strong style={{ display: "block", fontSize: "15px", marginBottom: "2px" }}>
                    {previewHeader || "Header Preview"}
                  </Text>
                  <Text style={{ fontSize: "14px", color: token.colorTextSecondary, lineHeight: 1.3 }}>
                    {previewBody || "Body Preview"}
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </Col>
    </Row>
  );
}
