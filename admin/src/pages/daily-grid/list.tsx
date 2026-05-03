import React, { useState, useEffect, useMemo } from "react";
import {
  Typography,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Switch,
  Space,
  Tag,
  Spin,
  App,
  Popconfirm,
  Select,
  Divider,
  Tooltip,
  Upload,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { apiClient } from "@/providers/api-client";
import type { ProductSpecDefinition, ServiceCategory } from "@/types/products";
import { normalizeServiceCategories } from "@/utils/api-normalizers";

const { Text, Title } = Typography;

interface DailyGridCard {
  id: number;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  category: string;
  categoryName?: string | null;
  categorySlug?: string;
  categoryIsActive?: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  specs: Record<string, unknown> | null;
  specDisplayValues?: Record<string, string>;
  isCatalogValid?: boolean;
  catalogIssue?: string | null;
}

function filterSpecUndefined(
  obj: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!obj) return null;
  const entries = Object.entries(obj).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function sortBySortOrder<T extends { sort_order: number; id: string }>(
  items: T[],
): T[] {
  return [...items].sort(
    (a, b) => a.sort_order - b.sort_order || Number(a.id) - Number(b.id),
  );
}

function isModelCategory(
  category?: ServiceCategory,
  fallbackSlug?: string,
): boolean {
  return (
    category?.file_processing_type === "model_3d" ||
    category?.slug === "3d" ||
    fallbackSlug === "3d"
  );
}

function humanizeSlug(value: string): string {
  return value
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isSpecHidden(spec: ProductSpecDefinition): boolean {
  return spec.metadata?.hidden === true;
}

const S = {
  page: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 24,
    paddingBottom: 48,
  },
  card: {
    background: "#141414",
    border: "1px solid #2E2E2E",
    borderRadius: 12,
    overflow: "hidden" as const,
    transition: "border-color 0.2s",
  },
  label: {
    color: "#555",
    fontSize: 10,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: 0,
  } as React.CSSProperties,
};

function CategoryBadge({
  category,
  categoryMeta,
  categoryName,
}: {
  category: string;
  categoryMeta?: ServiceCategory;
  categoryName?: string | null;
}) {
  const isModel = isModelCategory(categoryMeta, category);
  return (
    <Tag
      icon={isModel ? <AppstoreOutlined /> : <FileTextOutlined />}
      style={{
        background: isModel ? "#001A2E" : "#2A1F00",
        border: `1px solid ${isModel ? "#42A5F5" : "#FFDE58"}`,
        color: isModel ? "#42A5F5" : "#FFDE58",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {categoryMeta?.name ?? categoryName ?? humanizeSlug(category)}
    </Tag>
  );
}

/** Mini carousel card preview — mirrors the mobile card design */
function CardPreview({
  card,
  categoryMeta,
}: {
  card: DailyGridCard;
  categoryMeta?: ServiceCategory;
}) {
  const circleD = 64;
  const overhang = circleD / 2;
  const isModel = isModelCategory(categoryMeta, card.category);

  return (
    <div style={{ position: "relative", height: circleD, minWidth: 180 }}>
      {/* Card body */}
      <div
        style={{
          position: "absolute",
          left: overhang,
          right: 0,
          top: 0,
          bottom: 0,
          background: "#1A1A1A",
          borderRadius: 10,
          border: "1px solid #2E2E2E",
          paddingLeft: overhang + 8,
          paddingRight: 10,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            color: "#F0F0F0",
            fontWeight: 700,
            fontSize: 12,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 100,
          }}
        >
          {card.title || "Untitled"}
        </div>
        {card.subtitle && (
          <div style={{ color: "#666", fontSize: 10, marginTop: 2 }}>
            {card.subtitle}
          </div>
        )}
      </div>
      {/* Circle image */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: circleD,
          height: circleD,
          borderRadius: "50%",
          overflow: "hidden",
          border: "2px solid #0A0A0A",
          boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          background: "#1E1E1E",
          flexShrink: 0,
        }}
      >
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt={card.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isModel ? (
              <AppstoreOutlined style={{ color: "#333", fontSize: 22 }} />
            ) : (
              <FileTextOutlined style={{ color: "#333", fontSize: 22 }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DynamicSpecFields({ category }: { category: ServiceCategory }) {
  const specs = sortBySortOrder(
    (category.specs ?? []).filter(
      (spec) => spec.is_active && !isSpecHidden(spec),
    ),
  );

  if (specs.length === 0) {
    return (
      <Text
        style={{
          color: "#555",
          fontSize: 12,
          display: "block",
          marginBottom: 20,
        }}
      >
        This category has no active customer-visible specs.
      </Text>
    );
  }

  return (
    <div>
      <Divider style={{ borderColor: "#2A2A2A", marginBottom: 16 }}>
        <Text
          style={{
            color: "#555",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 0,
          }}
        >
          {category.name} Specs
        </Text>
      </Divider>
      <Text
        style={{
          color: "#555",
          fontSize: 11,
          display: "block",
          marginBottom: 12,
        }}
      >
        Optional — leave blank to use customer defaults
      </Text>
      {specs.map((spec) => (
        <Form.Item
          key={spec.key}
          label={
            <Text style={{ color: "#A0A0A0", fontSize: 12 }}>{spec.label}</Text>
          }
          name={["specs", spec.key]}
        >
          <SpecInput spec={spec} />
        </Form.Item>
      ))}
    </div>
  );
}

function SpecInput({ spec }: { spec: ProductSpecDefinition }) {
  if (spec.input_type === "select") {
    return (
      <Select
        allowClear
        placeholder="Default"
        options={sortBySortOrder(
          (spec.options ?? []).filter((option) => option.is_active),
        ).map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
    );
  }

  if (spec.value_type === "boolean") {
    return (
      <Select
        allowClear
        placeholder="Default"
        options={[
          { value: true, label: "Yes" },
          { value: false, label: "No" },
        ]}
      />
    );
  }

  if (spec.value_type === "number") {
    return (
      <InputNumber
        min={spec.min_value}
        max={spec.max_value}
        step={spec.step_value}
        placeholder={spec.placeholder ?? "Default"}
        style={{ width: "100%" }}
      />
    );
  }

  if (spec.input_type === "text") {
    return (
      <Input.TextArea rows={3} placeholder={spec.placeholder ?? "Default"} />
    );
  }

  return <Input placeholder={spec.placeholder ?? "Default"} />;
}

export function DailyGridList() {
  const { message, modal } = App.useApp();
  const [cards, setCards] = useState<DailyGridCard[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DailyGridCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form] = Form.useForm();
  const watchedCategory = Form.useWatch("category", form);
  const selectedCategory = useMemo(
    () => categories.find((category) => category.slug === watchedCategory),
    [categories, watchedCategory],
  );
  const categoryOptions = useMemo(() => {
    const options = categories.map((category) => ({
      value: category.slug,
      label: (
        <Space>
          {isModelCategory(category) ? (
            <AppstoreOutlined style={{ color: "#42A5F5" }} />
          ) : (
            <FileTextOutlined style={{ color: "#FFDE58" }} />
          )}
          <span>{category.name}</span>
        </Space>
      ),
    }));
    if (
      watchedCategory &&
      !options.some((option) => option.value === watchedCategory)
    ) {
      options.push({
        value: watchedCategory,
        label: <span>{humanizeSlug(watchedCategory)}</span>,
      });
    }
    return options;
  }, [categories, watchedCategory]);

  const fetchCards = async () => {
    try {
      const res = await apiClient.get("/daily-grid/admin");
      setCards(res.data as DailyGridCard[]);
    } catch {
      void message.error("Failed to load daily grid cards");
    }
  };

  const fetchCatalog = async () => {
    try {
      const res = await apiClient.get("/products/catalog");
      setCategories(normalizeServiceCategories(res.data?.categories ?? []));
    } catch {
      void message.error("Failed to load product catalog");
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchCards(), fetchCatalog()]);
      setLoading(false);
    };
    void load();
  }, []);

  const openCreate = () => {
    const defaultCategory = categories[0]?.slug ?? "paper";
    setEditTarget(null);
    setImagePreviewUrl("");
    form.resetFields();
    form.setFieldsValue({
      category: defaultCategory,
      isActive: true,
      sortOrder: cards.length,
    });
    setDrawerOpen(true);
  };

  const openEdit = (card: DailyGridCard) => {
    setEditTarget(card);
    setImagePreviewUrl(card.imageUrl ?? "");
    form.setFieldsValue({
      title: card.title,
      subtitle: card.subtitle ?? "",
      imageUrl: card.imageUrl ?? "",
      category: card.category,
      sortOrder: card.sortOrder,
      isActive: card.isActive,
      specs: card.specs ?? undefined,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        title: values.title,
        subtitle: values.subtitle || null,
        imageUrl: values.imageUrl || null,
        category: values.category,
        sortOrder: values.sortOrder ?? 0,
        isActive: values.isActive ?? true,
        specs: filterSpecUndefined(
          values.specs as Record<string, unknown> | undefined,
        ),
      };
      if (editTarget) {
        await apiClient.patch(`/daily-grid/admin/${editTarget.id}`, payload);
        void message.success("Card updated");
      } else {
        await apiClient.post("/daily-grid/admin", payload);
        void message.success("Card created");
      }
      setDrawerOpen(false);
      void fetchCards();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? "Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (card: DailyGridCard) => {
    try {
      await apiClient.patch(`/daily-grid/admin/${card.id}`, {
        isActive: !card.isActive,
      });
      void fetchCards();
    } catch {
      void message.error("Failed to update card");
    }
  };

  const handleDelete = (card: DailyGridCard) => {
    modal.confirm({
      title: "Delete card?",
      content: `"${card.title}" will be permanently removed from the carousel.`,
      okText: "Delete",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        try {
          await apiClient.delete(`/daily-grid/admin/${card.id}`);
          void message.success("Card deleted");
          void fetchCards();
        } catch {
          void message.error("Delete failed");
        }
      },
    });
  };

  const handleMove = async (index: number, direction: "up" | "down") => {
    const next = [...cards];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= next.length) return;
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    setCards(next);
    try {
      await apiClient.patch("/daily-grid/admin/reorder", {
        ids: next.map((c) => c.id),
      });
    } catch {
      void message.error("Reorder failed");
      void fetchCards();
    }
  };

  const activeCount = cards.filter((c) => c.isActive).length;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
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
          <Title
            level={3}
            style={{ color: "#F0F0F0", margin: 0, marginBottom: 4 }}
          >
            Daily Grid
          </Title>
          <Text style={{ color: "#555", fontSize: 13 }}>
            {activeCount} active card{activeCount !== 1 ? "s" : ""} shown in the
            customer carousel
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
          New Card
        </Button>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {cards.length === 0 && (
        <div style={{ ...S.card, padding: 48, textAlign: "center" }}>
          <AppstoreOutlined
            style={{ fontSize: 48, color: "#333", marginBottom: 16 }}
          />
          <Text style={{ color: "#555", display: "block", fontSize: 14 }}>
            No cards yet. Create one to start filling the carousel.
          </Text>
        </div>
      )}

      {/* ── Cards list ──────────────────────────────────────────────────── */}
      {cards.map((card, index) => {
        const categoryMeta = categories.find(
          (category) => category.slug === card.category,
        );
        const displaySpecs = Object.values(card.specDisplayValues ?? {}).filter(
          Boolean,
        );
        return (
          <div
            key={card.id}
            style={{
              ...S.card,
              opacity: card.isActive ? 1 : 0.55,
              borderColor: card.isActive ? "#2E2E2E" : "#1E1E1E",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 20,
                flexWrap: "wrap",
              }}
            >
              {/* Sort order controls */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <Tooltip title="Move up">
                  <Button
                    size="small"
                    icon={<ArrowUpOutlined />}
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0}
                    style={{
                      background: "#1A1A1A",
                      borderColor: "#2E2E2E",
                      color: index === 0 ? "#333" : "#808080",
                    }}
                  />
                </Tooltip>
                <div
                  style={{
                    textAlign: "center",
                    color: "#444",
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {index + 1}
                </div>
                <Tooltip title="Move down">
                  <Button
                    size="small"
                    icon={<ArrowDownOutlined />}
                    onClick={() => handleMove(index, "down")}
                    disabled={index === cards.length - 1}
                    style={{
                      background: "#1A1A1A",
                      borderColor: "#2E2E2E",
                      color: index === cards.length - 1 ? "#333" : "#808080",
                    }}
                  />
                </Tooltip>
              </div>

              {/* Card preview */}
              <div style={{ flexShrink: 0 }}>
                <div style={{ ...S.label, marginBottom: 6 }}>Preview</div>
                <CardPreview card={card} categoryMeta={categoryMeta} />
              </div>

              <Divider
                type="vertical"
                style={{ height: 72, borderColor: "#2A2A2A", margin: "0 4px" }}
              />

              {/* Details */}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <Text strong style={{ color: "#F0F0F0", fontSize: 14 }}>
                    {card.title}
                  </Text>
                  <CategoryBadge
                    category={card.category}
                    categoryMeta={categoryMeta}
                    categoryName={card.categoryName}
                  />
                  {!card.isActive && (
                    <Tag
                      style={{
                        background: "#1A1A1A",
                        borderColor: "#333",
                        color: "#555",
                        borderRadius: 6,
                        fontSize: 10,
                      }}
                    >
                      HIDDEN
                    </Tag>
                  )}
                  {card.isCatalogValid === false && (
                    <Tag
                      style={{
                        background: "#2A120F",
                        borderColor: "#7F2A1D",
                        color: "#FF8A65",
                        borderRadius: 6,
                        fontSize: 10,
                      }}
                    >
                      NEEDS CATALOG REVIEW
                    </Tag>
                  )}
                </div>
                {card.subtitle && (
                  <Text
                    style={{
                      color: "#666",
                      fontSize: 12,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {card.subtitle}
                  </Text>
                )}
                {displaySpecs.length > 0 && (
                  <Text
                    style={{
                      color: "#777",
                      fontSize: 11,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {displaySpecs.join(" · ")}
                  </Text>
                )}
                {card.isCatalogValid === false && (
                  <Text
                    style={{
                      color: "#FF8A65",
                      fontSize: 11,
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    {card.catalogIssue ??
                      "This card references inactive catalog data."}
                  </Text>
                )}
                {card.imageUrl && (
                  <Text
                    style={{
                      color: "#444",
                      fontSize: 11,
                      display: "block",
                      maxWidth: 260,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {card.imageUrl}
                  </Text>
                )}
              </div>

              {/* Actions */}
              <Space size={8} style={{ flexShrink: 0 }}>
                <Tooltip
                  title={
                    card.isActive ? "Hide from carousel" : "Show in carousel"
                  }
                >
                  <Button
                    size="small"
                    icon={
                      card.isActive ? <EyeOutlined /> : <EyeInvisibleOutlined />
                    }
                    onClick={() => handleToggleActive(card)}
                    style={{
                      background: card.isActive ? "#0D2A0D" : "#1A1A1A",
                      borderColor: card.isActive ? "#2E7D32" : "#2E2E2E",
                      color: card.isActive ? "#66BB6A" : "#555",
                    }}
                  >
                    {card.isActive ? "Live" : "Hidden"}
                  </Button>
                </Tooltip>
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => openEdit(card)}
                  style={{
                    background: "#1A1A1A",
                    borderColor: "#2E2E2E",
                    color: "#A0A0A0",
                  }}
                >
                  Edit
                </Button>
                <Popconfirm
                  title="Delete this card?"
                  description={`"${card.title}" will be removed permanently.`}
                  onConfirm={() => handleDelete(card)}
                  okText="Delete"
                  okButtonProps={{ danger: true }}
                  cancelText="Cancel"
                >
                  <Button
                    size="small"
                    icon={<DeleteOutlined />}
                    danger
                    style={{
                      background: "#1A1A1A",
                      borderColor: "#3A1A1A",
                      color: "#EF5350",
                    }}
                  />
                </Popconfirm>
              </Space>
            </div>
          </div>
        );
      })}

      {/* ── Create / Edit Drawer ─────────────────────────────────────────── */}
      <Drawer
        title={
          <Text style={{ color: "#F0F0F0", fontWeight: 700, fontSize: 15 }}>
            {editTarget ? "Edit Card" : "New Card"}
          </Text>
        }
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={460}
        extra={
          <Button
            type="primary"
            loading={saving}
            onClick={handleSave}
            style={{
              background: "#FFDE58",
              borderColor: "#FFDE58",
              color: "#141414",
              fontWeight: 700,
            }}
          >
            {editTarget ? "Update" : "Create"}
          </Button>
        }
        styles={{
          body: { background: "#0F0F0F", padding: 24 },
          header: { background: "#141414", borderBottom: "1px solid #2E2E2E" },
        }}
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changed) => {
            if ("category" in changed) {
              form.setFieldValue("specs", undefined);
            }
          }}
        >
          <Form.Item
            label={
              <Text style={{ color: "#A0A0A0", fontSize: 12 }}>Title</Text>
            }
            name="title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input placeholder="Bond Paper A4" maxLength={40} showCount />
          </Form.Item>

          <Form.Item
            label={
              <Text style={{ color: "#A0A0A0", fontSize: 12 }}>Subtitle</Text>
            }
            name="subtitle"
          >
            <Input placeholder="₱15 / page" maxLength={40} showCount />
          </Form.Item>

          {/* Image Upload */}
          <Form.Item
            label={
              <Text style={{ color: "#A0A0A0", fontSize: 12 }}>Image</Text>
            }
            name="imageUrl"
          >
            <Input
              placeholder="Image URL (paste or upload below)"
              onChange={(e) => setImagePreviewUrl(e.target.value)}
            />
          </Form.Item>
          <Form.Item style={{ marginTop: -16 }}>
            <Upload
              accept="image/jpeg,image/png,image/webp"
              showUploadList={false}
              beforeUpload={(file) => {
                const formData = new FormData();
                formData.append("file", file);
                setUploadingImage(true);
                apiClient
                  .post<{ url: string }>(
                    "/daily-grid/admin/upload-image",
                    formData,
                  )
                  .then((res) => {
                    form.setFieldValue("imageUrl", res.data.url);
                    setImagePreviewUrl(res.data.url);
                    void message.success("Image uploaded");
                  })
                  .catch(() => void message.error("Image upload failed"))
                  .finally(() => setUploadingImage(false));
                return false; // prevent default upload
              }}
            >
              <Button
                icon={<UploadOutlined />}
                loading={uploadingImage}
                style={{
                  background: "#1A1A1A",
                  borderColor: "#2E2E2E",
                  color: "#A0A0A0",
                }}
              >
                Upload Image
              </Button>
            </Upload>
          </Form.Item>

          {/* Live image preview */}
          {imagePreviewUrl && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ ...S.label, marginBottom: 8 }}>Card Preview</div>
              <CardPreview
                card={{
                  id: 0,
                  title: form.getFieldValue("title") || "Title",
                  subtitle: form.getFieldValue("subtitle") || null,
                  imageUrl: imagePreviewUrl,
                  category: form.getFieldValue("category") || "paper",
                  sortOrder: 0,
                  isActive: true,
                  createdAt: "",
                  specs: null,
                }}
                categoryMeta={selectedCategory}
              />
            </div>
          )}

          <Form.Item
            label={
              <Text style={{ color: "#A0A0A0", fontSize: 12 }}>
                Printing Category
              </Text>
            }
            name="category"
            rules={[{ required: true }]}
          >
            <Select
              options={categoryOptions}
              disabled={categoryOptions.length === 0}
            />
          </Form.Item>
          {selectedCategory && (
            <DynamicSpecFields category={selectedCategory} />
          )}

          <Form.Item
            label={
              <Text style={{ color: "#A0A0A0", fontSize: 12 }}>Sort Order</Text>
            }
            name="sortOrder"
            help={
              <Text style={{ color: "#444", fontSize: 11 }}>
                Lower = appears first. Use arrows on the list to reorder.
              </Text>
            }
          >
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item
            label={
              <Text style={{ color: "#A0A0A0", fontSize: 12 }}>Active</Text>
            }
            name="isActive"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
