import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Drawer,
  Form,
  TimePicker,
  Switch,
  App,
  theme,
  Slider,
  Select,
  Spin,
  Empty,
  Typography,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  ClockCircleOutlined,
  EditOutlined,
  DeleteOutlined,
  PoweroffOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { apiClient } from "@/providers/api-client";
import type { DeliverySlotTemplate } from "@/types/delivery-slot";

const { Title, Text } = Typography;

const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface FormValues {
  dayOfWeek: number;
  startTime: Dayjs;
  endTime: Dayjs;
  capacity: number;
  isActive: boolean;
}

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hh = Number(h);
  const ampm = hh >= 12 ? "PM" : "AM";
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${hour12}:${m} ${ampm}`;
}

function durationLabel(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function DeliverySlotTemplatesPage() {
  const { token } = theme.useToken();
  const { message, modal } = App.useApp();
  const [templates, setTemplates] = useState<DeliverySlotTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<DeliverySlotTemplate | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<DeliverySlotTemplate[]>(
        "/admin/delivery-slot-templates",
      );
      setTemplates(res.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const grouped = useMemo(() => {
    const map: Record<number, DeliverySlotTemplate[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    for (const t of templates) {
      if (map[t.dayOfWeek]) {
        map[t.dayOfWeek].push(t);
      }
    }
    for (const day in map) {
      map[Number(day)].sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [templates]);

  const stats = useMemo(() => {
    const active = templates.filter((t) => t.isActive);
    const totalCapacity = active.reduce((sum, t) => sum + t.capacity, 0);
    const daysWithSlots = new Set(active.map((t) => t.dayOfWeek)).size;
    return { active: active.length, total: templates.length, totalCapacity, daysWithSlots };
  }, [templates]);

  const openCreate = (dayOfWeek?: number) => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      dayOfWeek: dayOfWeek ?? 1,
      startTime: dayjs("09:30", "HH:mm"),
      endTime: dayjs("11:30", "HH:mm"),
      capacity: 10,
      isActive: true,
    });
    setDrawerOpen(true);
  };

  const openEdit = (t: DeliverySlotTemplate) => {
    setEditing(t);
    form.setFieldsValue({
      dayOfWeek: t.dayOfWeek,
      startTime: dayjs(t.startTime, "HH:mm:ss"),
      endTime: dayjs(t.endTime, "HH:mm:ss"),
      capacity: t.capacity,
      isActive: t.isActive,
    });
    setDrawerOpen(true);
  };

  const onSave = async (values: FormValues) => {
    const payload = {
      dayOfWeek: values.dayOfWeek,
      startTime: values.startTime.format("HH:mm:ss"),
      endTime: values.endTime.format("HH:mm:ss"),
      capacity: values.capacity,
      isActive: values.isActive,
    };
    try {
      if (editing) {
        await apiClient.patch(
          `/admin/delivery-slot-templates/${editing.id}`,
          payload,
        );
        void message.success("Slot template updated");
      } else {
        await apiClient.post("/admin/delivery-slot-templates", payload);
        void message.success("Slot template created");
      }
      setDrawerOpen(false);
      setEditing(null);
      form.resetFields();
      void refresh();
    } catch (err: any) {
      void message.error(err?.response?.data?.message || "Save failed");
    }
  };

  const confirmDelete = (t: DeliverySlotTemplate) => {
    modal.confirm({
      title: "Delete this slot?",
      content: `${DAY_LONG[t.dayOfWeek]} · ${formatTime(t.startTime)} – ${formatTime(t.endTime)}`,
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/admin/delivery-slot-templates/${t.id}`);
          void message.success("Slot deleted");
          void refresh();
        } catch {
          void message.error("Delete failed");
        }
      },
    });
  };

  const toggleActive = async (t: DeliverySlotTemplate) => {
    try {
      await apiClient.patch(`/admin/delivery-slot-templates/${t.id}`, {
        isActive: !t.isActive,
      });
      void refresh();
    } catch {
      void message.error("Toggle failed");
    }
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 8,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ marginBottom: 4 }}>
            Delivery Slot Templates
          </Title>
          <Text type="secondary">
            Recurring weekly schedule. Riders run these batched delivery windows.
          </Text>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          onClick={() => openCreate()}
        >
          New Slot
        </Button>
      </div>

      {/* Stats strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginTop: 20,
          marginBottom: 24,
        }}
      >
        <_StatCard
          token={token}
          label="Active slots"
          value={stats.active}
          accent
          suffix={stats.total > 0 ? `of ${stats.total}` : undefined}
        />
        <_StatCard
          token={token}
          label="Days with slots"
          value={stats.daysWithSlots}
          suffix="of 7"
        />
        <_StatCard
          token={token}
          label="Daily capacity"
          value={stats.totalCapacity}
          suffix="stops/week"
        />
      </div>

      {/* Schedule grid */}
      {loading && templates.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
          <Spin size="large" />
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: 8,
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorder}`,
            borderRadius: 12,
            padding: 12,
          }}
        >
          {DAY_NAMES.map((short, dayIdx) => {
            const slots = grouped[dayIdx];
            const isToday = new Date().getDay() === dayIdx;
            return (
              <div
                key={dayIdx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  minHeight: 280,
                }}
              >
                {/* Day header */}
                <div
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: isToday
                      ? "rgba(255,222,88,0.10)"
                      : "transparent",
                    border: `1px solid ${isToday ? "rgba(255,222,88,0.30)" : "transparent"}`,
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      color: isToday ? "#FFDE58" : token.colorTextSecondary,
                    }}
                  >
                    {short}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: token.colorTextTertiary,
                      marginTop: 2,
                    }}
                  >
                    {slots.length === 0
                      ? "No slots"
                      : `${slots.length} slot${slots.length > 1 ? "s" : ""}`}
                  </div>
                </div>

                {/* Slot cards */}
                {slots.map((slot) => (
                  <_SlotCard
                    key={slot.id}
                    slot={slot}
                    token={token}
                    onEdit={() => openEdit(slot)}
                    onDelete={() => confirmDelete(slot)}
                    onToggle={() => toggleActive(slot)}
                  />
                ))}

                {/* Add tile */}
                <button
                  type="button"
                  onClick={() => openCreate(dayIdx)}
                  style={{
                    border: `1px dashed ${token.colorBorder}`,
                    background: "transparent",
                    color: token.colorTextTertiary,
                    borderRadius: 8,
                    padding: "10px 0",
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#FFDE58";
                    e.currentTarget.style.color = "#FFDE58";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = token.colorBorder;
                    e.currentTarget.style.color = token.colorTextTertiary;
                  }}
                >
                  <PlusOutlined style={{ fontSize: 11 }} />
                  ADD
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div style={{ marginTop: 24 }}>
          <Empty
            description={
              <span style={{ color: token.colorTextSecondary }}>
                No slots configured yet
              </span>
            }
          >
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
              Create first slot
            </Button>
          </Empty>
        </div>
      )}

      {/* Drawer */}
      <Drawer
        title={editing ? "Edit Slot" : "New Slot"}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        width={420}
        destroyOnHidden
      >
        <Form<FormValues> form={form} layout="vertical" onFinish={onSave}>
          <Form.Item
            name="dayOfWeek"
            label="Day"
            rules={[{ required: true }]}
          >
            <Select
              size="large"
              options={DAY_LONG.map((label, value) => ({ label, value }))}
            />
          </Form.Item>

          <div style={{ display: "flex", gap: 12 }}>
            <Form.Item
              name="startTime"
              label="Start time"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <TimePicker
                size="large"
                style={{ width: "100%" }}
                format="HH:mm"
                minuteStep={5}
                allowClear={false}
              />
            </Form.Item>
            <Form.Item
              name="endTime"
              label="End time"
              rules={[{ required: true }]}
              style={{ flex: 1 }}
            >
              <TimePicker
                size="large"
                style={{ width: "100%" }}
                format="HH:mm"
                minuteStep={5}
                allowClear={false}
              />
            </Form.Item>
          </div>

          <Form.Item
            name="capacity"
            label="Capacity (stops per slot)"
            rules={[{ required: true }]}
          >
            <Slider
              min={1}
              max={30}
              marks={{ 1: "1", 10: "10", 20: "20", 30: "30" }}
            />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="Status"
            valuePropName="checked"
            style={{ marginBottom: 24 }}
          >
            <Switch
              checkedChildren="Active"
              unCheckedChildren="Disabled"
            />
          </Form.Item>

          <div style={{ display: "flex", gap: 12 }}>
            <Button
              size="large"
              onClick={() => setDrawerOpen(false)}
              block
            >
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" size="large" block>
              {editing ? "Save changes" : "Create slot"}
            </Button>
          </div>
        </Form>
      </Drawer>
    </div>
  );
}

function _StatCard({
  token,
  label,
  value,
  suffix,
  accent,
}: {
  token: any;
  label: string;
  value: number;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: token.colorBgElevated,
        border: `1px solid ${accent ? "rgba(255,222,88,0.30)" : token.colorBorder}`,
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.10em",
          color: token.colorTextSecondary,
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: accent ? "#FFDE58" : token.colorText,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {suffix && (
          <span style={{ fontSize: 12, color: token.colorTextTertiary }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function _SlotCard({
  slot,
  token,
  onEdit,
  onDelete,
  onToggle,
}: {
  slot: DeliverySlotTemplate;
  token: any;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const dimmed = !slot.isActive;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onEdit}
      style={{
        position: "relative",
        background: dimmed
          ? token.colorBgContainer
          : token.colorBgElevated,
        border: `1px solid ${
          hovered && !dimmed
            ? "rgba(255,222,88,0.50)"
            : token.colorBorder
        }`,
        borderLeft: dimmed
          ? `3px solid ${token.colorBorder}`
          : `3px solid #FFDE58`,
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        transition: "all 0.15s ease",
        opacity: dimmed ? 0.55 : 1,
        boxShadow:
          hovered && !dimmed
            ? "0 4px 12px rgba(255,222,88,0.10)"
            : "none",
      }}
    >
      {/* Time */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: 8,
        }}
      >
        <ClockCircleOutlined
          style={{
            fontSize: 11,
            color: dimmed ? token.colorTextTertiary : "#FFDE58",
          }}
        />
        <Text
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: token.colorText,
            fontFamily:
              "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
            letterSpacing: "0.02em",
          }}
        >
          {formatTime(slot.startTime)}
        </Text>
      </div>
      <div
        style={{
          fontSize: 9,
          color: token.colorTextTertiary,
          fontWeight: 700,
          letterSpacing: "0.10em",
          marginLeft: 16,
          marginBottom: 4,
          marginTop: -4,
        }}
      >
        ↓ {durationLabel(slot.startTime, slot.endTime)}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          marginBottom: 10,
        }}
      >
        <ClockCircleOutlined
          style={{
            fontSize: 11,
            color: token.colorTextTertiary,
          }}
        />
        <Text
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: token.colorText,
            fontFamily:
              "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
            letterSpacing: "0.02em",
          }}
        >
          {formatTime(slot.endTime)}
        </Text>
      </div>

      {/* Capacity */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: 8,
          borderTop: `1px dashed ${token.colorBorder}`,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.10em",
              color: token.colorTextTertiary,
              textTransform: "uppercase",
            }}
          >
            Capacity
          </div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: dimmed ? token.colorTextSecondary : token.colorText,
              lineHeight: 1.1,
              marginTop: 2,
            }}
          >
            {slot.capacity}
          </div>
        </div>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: dimmed
              ? token.colorTextTertiary
              : "#52C41A",
            boxShadow: dimmed
              ? "none"
              : "0 0 0 2px rgba(82,196,26,0.18)",
          }}
        />
      </div>

      {/* Hover actions */}
      {hovered && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            display: "flex",
            gap: 4,
            background: token.colorBgContainer,
            borderRadius: 6,
            border: `1px solid ${token.colorBorder}`,
            padding: 2,
          }}
        >
          <Tooltip title={slot.isActive ? "Disable" : "Enable"}>
            <button
              type="button"
              onClick={onToggle}
              style={{
                background: "transparent",
                border: "none",
                color: token.colorTextSecondary,
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 4,
              }}
            >
              <PoweroffOutlined style={{ fontSize: 11 }} />
            </button>
          </Tooltip>
          <Tooltip title="Edit">
            <button
              type="button"
              onClick={onEdit}
              style={{
                background: "transparent",
                border: "none",
                color: token.colorTextSecondary,
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 4,
              }}
            >
              <EditOutlined style={{ fontSize: 11 }} />
            </button>
          </Tooltip>
          <Tooltip title="Delete">
            <button
              type="button"
              onClick={onDelete}
              style={{
                background: "transparent",
                border: "none",
                color: "#FF4D4F",
                cursor: "pointer",
                padding: "4px 6px",
                borderRadius: 4,
              }}
            >
              <DeleteOutlined style={{ fontSize: 11 }} />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
