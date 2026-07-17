import React, { useCallback, useEffect, useState } from "react";
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Spin,
  Switch,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { apiClient } from "@/providers/api-client";

const { Text, Title } = Typography;

export type HomeFeedMode = "auto" | "community" | "promo";

export interface PromoCard {
  id: number;
  title: string;
  body: string | null;
  ctaLabel: string | null;
  ctaTarget: string | null;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export function normalizeHomeFeedMode(raw: Record<string, unknown>): HomeFeedMode {
  const mode = raw["mode"];
  return mode === "community" || mode === "promo" ? mode : "auto";
}

export function normalizePromoCard(raw: Record<string, unknown>): PromoCard {
  const pickString = (camel: string, snake: string): string | null => {
    const value = raw[camel] ?? raw[snake];
    return typeof value === "string" && value.trim() !== "" ? value : null;
  };
  const pickNumber = (camel: string, snake: string): number => {
    const value = raw[camel] ?? raw[snake];
    return typeof value === "number" ? value : Number(value ?? 0);
  };
  return {
    id: pickNumber("id", "id"),
    title: pickString("title", "title") ?? "",
    body: pickString("body", "body"),
    ctaLabel: pickString("ctaLabel", "cta_label"),
    ctaTarget: pickString("ctaTarget", "cta_target"),
    imageUrl: pickString("imageUrl", "image_url"),
    sortOrder: pickNumber("sortOrder", "sort_order"),
    isActive: Boolean(raw["isActive"] ?? raw["is_active"] ?? true),
  };
}

const CTA_PRESETS = [
  { label: "Start printing", value: "/customer/order/new" },
  { label: "The Data Grid (uploads)", value: "/customer/uploads" },
  { label: "Top up credits", value: "/customer/profile/top-up" },
  { label: "Custom route or URL…", value: "custom" },
] as const;

const MODE_HELP: Record<HomeFeedMode, string> = {
  auto: "Shows community feedback when it exists, otherwise your live campaigns.",
  community: "Always shows community feedback (or an invite while it's empty).",
  promo: "Always shows the campaign carousel below.",
};

const MAX_ACTIVE = 5;

const S: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", gap: 16 },
  card: {
    background: "#141414",
    border: "1px solid #2E2E2E",
    borderRadius: 12,
    padding: 20,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "10px 0",
    borderBottom: "1px solid #222",
  },
  thumb: {
    width: 64,
    height: 44,
    borderRadius: 6,
    objectFit: "cover" as const,
    background: "#222",
    flexShrink: 0,
  },
  label: {
    color: "#A0A0A0",
    fontSize: 12,
    display: "block",
    marginBottom: 4,
    marginTop: 12,
  },
};

interface DrawerState {
  open: boolean;
  editing: PromoCard | null;
}

export function HomeFeedPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<HomeFeedMode>("auto");
  const [cards, setCards] = useState<PromoCard[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>({ open: false, editing: null });
  const [ctaPreset, setCtaPreset] = useState<string>(CTA_PRESETS[0].value);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, cardsRes] = await Promise.all([
        apiClient.get("/home-feed/settings"),
        apiClient.get("/home-feed/promo-cards"),
      ]);
      setMode(normalizeHomeFeedMode(settingsRes.data as Record<string, unknown>));
      setCards(
        (cardsRes.data as Record<string, unknown>[]).map(normalizePromoCard),
      );
    } catch {
      void message.error("Couldn't load the home feed configuration");
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const errorDetail = (err: unknown, fallback: string): string => {
    const detail =
      (err as { response?: { data?: { message?: string | string[] } } })
        .response?.data?.message ?? fallback;
    return Array.isArray(detail) ? detail.join(", ") : detail;
  };

  const handleModeChange = async (value: HomeFeedMode) => {
    const previous = mode;
    setMode(value);
    try {
      await apiClient.patch("/home-feed/settings", { mode: value });
      void message.success("Mode saved — customer home screens update instantly.");
    } catch (err) {
      setMode(previous);
      void message.error(errorDetail(err, "Couldn't save the mode"));
    }
  };

  const handleToggleActive = async (card: PromoCard, next: boolean) => {
    try {
      await apiClient.patch(`/home-feed/promo-cards/${card.id}`, {
        isActive: next,
      });
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, isActive: next } : c)),
      );
    } catch (err) {
      void message.error(errorDetail(err, "Couldn't update the campaign"));
    }
  };

  const handleDelete = async (card: PromoCard) => {
    try {
      await apiClient.delete(`/home-feed/promo-cards/${card.id}`);
      setCards((prev) => prev.filter((c) => c.id !== card.id));
      void message.success("Campaign deleted");
    } catch (err) {
      void message.error(errorDetail(err, "Couldn't delete the campaign"));
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= cards.length) return;
    const next = [...cards];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setCards(next);
    try {
      await apiClient.patch("/home-feed/promo-cards/reorder", {
        ids: next.map((c) => c.id),
      });
    } catch {
      void message.error("Reorder failed");
      void fetchAll();
    }
  };

  const openCreate = () => {
    form.resetFields();
    setCtaPreset(CTA_PRESETS[0].value);
    setImagePreviewUrl(null);
    setDrawer({ open: true, editing: null });
  };

  const openEdit = (card: PromoCard) => {
    form.setFieldsValue({
      title: card.title,
      body: card.body ?? "",
      ctaLabel: card.ctaLabel ?? "",
      ctaTarget: card.ctaTarget ?? "",
      imageUrl: card.imageUrl ?? "",
    });
    const preset = CTA_PRESETS.find((p) => p.value === card.ctaTarget);
    setCtaPreset(preset ? preset.value : "custom");
    setImagePreviewUrl(card.imageUrl);
    setDrawer({ open: true, editing: card });
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      title: (values.title as string).trim(),
      body: (values.body as string)?.trim() || null,
      ctaLabel: (values.ctaLabel as string)?.trim() || null,
      ctaTarget:
        ctaPreset === "custom"
          ? (values.ctaTarget as string)?.trim() || null
          : ctaPreset,
      imageUrl: (values.imageUrl as string)?.trim() || null,
    };
    setSaving(true);
    try {
      if (drawer.editing) {
        await apiClient.patch(
          `/home-feed/promo-cards/${drawer.editing.id}`,
          payload,
        );
      } else {
        await apiClient.post("/home-feed/promo-cards", payload);
      }
      setDrawer({ open: false, editing: null });
      void message.success(
        drawer.editing ? "Campaign updated" : "Campaign created",
      );
      void fetchAll();
    } catch (err) {
      void message.error(errorDetail(err, "Couldn't save the campaign"));
    } finally {
      setSaving(false);
    }
  };

  const activeCards = cards.filter((c) => c.isActive);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={S.page} data-testid="home-feed-page">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ color: "#F0F0F0", margin: 0, marginBottom: 4 }}>
            Home Feed
          </Title>
          <Text style={{ color: "#555", fontSize: 13 }}>
            "The Feed" tile on the customer home screen — changes reach open
            apps instantly
          </Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreate}
          style={{
            background: "#FFDE58",
            borderColor: "#FFDE58",
            color: "#141414",
            fontWeight: 700,
          }}
        >
          New Campaign
        </Button>
      </div>

      {/* ── Mode ─────────────────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <ThunderboltOutlined style={{ color: "#FFDE58" }} />
          <Text style={{ color: "#F0F0F0", fontWeight: 600 }}>Tile mode</Text>
        </div>
        <Segmented
          value={mode}
          onChange={(value) => void handleModeChange(value as HomeFeedMode)}
          options={[
            { label: "Auto", value: "auto" },
            { label: "Community feed", value: "community" },
            { label: "Promo cards", value: "promo" },
          ]}
        />
        <Text style={{ color: "#A0A0A0", fontSize: 12, display: "block", marginTop: 6 }}>
          {MODE_HELP[mode]}
        </Text>
      </div>

      {/* ── Campaigns ────────────────────────────────────────────────────── */}
      <div style={S.card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <Text style={{ color: "#F0F0F0", fontWeight: 600 }}>
            Campaigns{" "}
            <Text style={{ color: "#555", fontSize: 12 }}>
              {activeCards.length}/{MAX_ACTIVE} live
            </Text>
          </Text>
          <Text style={{ color: "#555", fontSize: 12 }}>
            Customers see live campaigns in this order
          </Text>
        </div>

        {cards.length === 0 && (
          <div style={{ padding: 32, textAlign: "center" }}>
            <Text style={{ color: "#555", fontSize: 13 }}>
              No campaigns yet. Create one to fill the tile with marketing
              content.
            </Text>
          </div>
        )}

        {cards.map((card, index) => (
          <div key={card.id} style={S.row} data-testid={`campaign-row-${card.id}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Button
                size="small"
                type="text"
                icon={<ArrowUpOutlined style={{ fontSize: 10 }} />}
                disabled={index === 0}
                onClick={() => void handleMove(index, -1)}
              />
              <Button
                size="small"
                type="text"
                icon={<ArrowDownOutlined style={{ fontSize: 10 }} />}
                disabled={index === cards.length - 1}
                onClick={() => void handleMove(index, 1)}
              />
            </div>
            {card.imageUrl ? (
              <img src={card.imageUrl} alt="" style={S.thumb} />
            ) : (
              <div
                style={{
                  ...S.thumb,
                  background: "#FFDE58",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#141414",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                TEXT
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{ color: "#F0F0F0", fontWeight: 600, display: "block" }}
                ellipsis
              >
                {card.title}
              </Text>
              <Text style={{ color: "#777", fontSize: 12 }} ellipsis>
                {card.body ?? "—"}
              </Text>
            </div>
            {card.ctaLabel && (
              <Tag style={{ background: "#222", color: "#FFDE58", border: "none" }}>
                {card.ctaLabel}
              </Tag>
            )}
            <Switch
              size="small"
              checked={card.isActive}
              checkedChildren="Live"
              unCheckedChildren="Hidden"
              onChange={(next) => void handleToggleActive(card, next)}
            />
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEdit(card)}
            />
            <Popconfirm
              title="Delete this campaign?"
              onConfirm={() => void handleDelete(card)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
        ))}
      </div>

      {/* ── Drawer ───────────────────────────────────────────────────────── */}
      <Drawer
        title={drawer.editing ? "Edit campaign" : "New campaign"}
        open={drawer.open}
        onClose={() => setDrawer({ open: false, editing: null })}
        width={420}
        destroyOnClose
        extra={
          <Button
            type="primary"
            loading={saving}
            onClick={() => void handleSubmit()}
            style={{
              background: "#FFDE58",
              borderColor: "#FFDE58",
              color: "#141414",
              fontWeight: 700,
            }}
          >
            Save
          </Button>
        }
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Text style={S.label}>Title</Text>
          <Form.Item
            name="title"
            rules={[{ required: true, message: "Title is required" }]}
            style={{ marginBottom: 0 }}
          >
            <Input maxLength={80} placeholder="A3 posters at ₱75" />
          </Form.Item>

          <Text style={S.label}>Body (optional)</Text>
          <Form.Item name="body" style={{ marginBottom: 0 }}>
            <Input.TextArea
              maxLength={220}
              rows={2}
              placeholder="This week only — same-day batch delivery."
            />
          </Form.Item>

          <Text style={S.label}>Button label (optional)</Text>
          <Form.Item name="ctaLabel" style={{ marginBottom: 0 }}>
            <Input maxLength={32} placeholder="Start printing" />
          </Form.Item>

          <Text style={S.label}>Button destination</Text>
          <Select
            style={{ width: "100%" }}
            value={ctaPreset}
            options={CTA_PRESETS.map((p) => ({ label: p.label, value: p.value }))}
            onChange={setCtaPreset}
          />
          {ctaPreset === "custom" && (
            <Form.Item name="ctaTarget" style={{ marginBottom: 0, marginTop: 6 }}>
              <Input placeholder="/customer/order/new or https://…" />
            </Form.Item>
          )}

          <Text style={S.label}>Image</Text>
          <Form.Item name="imageUrl" style={{ marginBottom: 6 }}>
            <Input
              placeholder="Image URL (paste or upload below)"
              onChange={(e) => setImagePreviewUrl(e.target.value)}
            />
          </Form.Item>
          <Upload
            accept="image/jpeg,image/png,image/webp"
            showUploadList={false}
            beforeUpload={(file) => {
              const formData = new FormData();
              formData.append("file", file);
              setUploadingImage(true);
              apiClient
                .post<{ url: string }>("/home-feed/admin/upload-image", formData)
                .then((res) => {
                  form.setFieldValue("imageUrl", res.data.url);
                  setImagePreviewUrl(res.data.url);
                })
                .catch((err) =>
                  message.error(errorDetail(err, "Upload failed")),
                )
                .finally(() => setUploadingImage(false));
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={uploadingImage} size="small">
              Upload image
            </Button>
          </Upload>
          {imagePreviewUrl && (
            <img
              src={imagePreviewUrl}
              alt="preview"
              style={{
                marginTop: 10,
                width: "100%",
                height: 140,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #2E2E2E",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </Form>
      </Drawer>
    </div>
  );
}
