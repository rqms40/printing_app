import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useGetIdentity } from "@refinedev/core";
import { List } from "@refinedev/antd";
import {
  App,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Upload,
} from "antd";
import {
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { isSupplierRole } from "@/types/enums";
import type { AdminIdentity } from "@/utils/api-normalizers";
import { formatCurrency } from "@/utils/format";
import {
  importMyCatalogFile,
  listMyCatalogOfferings,
  listOrderableCatalogCategories,
  removeMyCatalogOffering,
  upsertMyCatalogOffering,
  type CatalogCategoryOption,
  type SupplierCatalogOffering,
} from "@/services/suppliersAdminApi";
import { extractApiError } from "@/services/supplierJobsApi";

const { Text, Paragraph } = Typography;

export function SupplierCatalogPage() {
  const { message, modal } = App.useApp();
  const { data: identity, isLoading: identityLoading } =
    useGetIdentity<AdminIdentity>();
  const [rows, setRows] = useState<SupplierCatalogOffering[]>([]);
  const [categories, setCategories] = useState<CatalogCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<{ title: string; categorySlugs: string[] }>();

  const load = useCallback(async () => {
    if (!isSupplierRole(identity?.role)) return;
    setLoading(true);
    try {
      const [offerings, cats] = await Promise.all([
        listMyCatalogOfferings(),
        listOrderableCatalogCategories(),
      ]);
      setRows(offerings);
      setCategories(cats);
    } catch (err) {
      message.error(extractApiError(err));
    } finally {
      setLoading(false);
    }
  }, [identity?.role, message]);

  useEffect(() => {
    if (!identityLoading) void load();
  }, [identityLoading, load]);

  if (!identityLoading && !isSupplierRole(identity?.role)) {
    return <Navigate to="/" replace />;
  }

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await importMyCatalogFile(file);
      await load();
      if (result.warnings.length > 0) {
        message.warning(result.warnings.join(" · "));
      } else {
        message.success(
          result.offerings > 0
            ? `Imported ${result.offerings} catalog product${result.offerings === 1 ? "" : "s"}`
            : "Catalog imported",
        );
      }
    } catch (err) {
      message.error(extractApiError(err));
    } finally {
      setUploading(false);
    }
    return false;
  };

  const onAdd = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const next = await upsertMyCatalogOffering({
        title: values.title.trim(),
        categorySlugs: values.categorySlugs,
      });
      setRows(next);
      setAddOpen(false);
      form.resetFields();
      message.success("Catalog product saved");
    } catch (err) {
      message.error(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (row: SupplierCatalogOffering) => {
    modal.confirm({
      title: `Remove ${row.title}?`,
      content:
        "This only removes your shop offering. Shared catalog specs stay available for other shops.",
      okText: "Remove",
      okButtonProps: { danger: true },
      onOk: async () => {
        await removeMyCatalogOffering(row.id);
        await load();
        message.success("Removed");
      },
    });
  };

  return (
    <List
      title="Shop catalog"
      headerButtons={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            Refresh
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => setAddOpen(true)}
          >
            Add product
          </Button>
        </Space>
      }
    >
      <Paragraph type="secondary" style={{ marginTop: -8 }}>
        Upload a price list (.docx, .pdf, or Excel) or add products by hand.
        Customers see merged specs across shops in the same category. Ops
        assignment greys out shops that cannot fulfill the selected options.
      </Paragraph>

      <Upload.Dragger
        accept=".docx,.pdf,.xlsx,.xls,.csv"
        showUploadList={false}
        disabled={uploading}
        beforeUpload={(file) => {
          void onUpload(file);
          return false;
        }}
        style={{ marginBottom: 24 }}
      >
        <p className="ant-upload-drag-icon">
          <UploadOutlined />
        </p>
        <p className="ant-upload-text">
          {uploading ? "Importing catalog…" : "Drop a catalog file here, or click to upload"}
        </p>
        <p className="ant-upload-hint">DOCX, PDF, or Excel price lists</p>
      </Upload.Dragger>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <Empty description="No catalog items yet. Upload a shop price list to fill specs, sizes, and add-ons." />
      ) : (
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          {rows.map((row) => (
            <Card
              key={row.id}
              size="small"
              title={row.title}
              extra={
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onDelete(row)}
                >
                  Remove
                </Button>
              }
            >
              <Space direction="vertical" size={6} style={{ width: "100%" }}>
                {row.baseRatePesos != null && (
                  <Text>
                    {formatCurrency(row.baseRatePesos)}
                    {row.pricingUnit ? ` / ${row.pricingUnit}` : ""}
                  </Text>
                )}
                <Space wrap size={[4, 4]}>
                  {row.categorySlugs.map((slug) => (
                    <Tag key={slug}>{slug}</Tag>
                  ))}
                </Space>
                {Object.entries(row.specOptions).map(([key, values]) => (
                  <Text key={key} type="secondary">
                    {key.replace(/_/g, " ")}: {values.join(", ")}
                  </Text>
                ))}
                {row.addons.length > 0 && (
                  <Text type="secondary">
                    Add-ons: {row.addons.map((addon) => addon.name).join(", ")}
                  </Text>
                )}
                {row.sourceFileName && (
                  <Tag>{row.sourceFileName}</Tag>
                )}
              </Space>
            </Card>
          ))}
        </Space>
      )}

      <Modal
        title="Add catalog product"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={() => void onAdd()}
        confirmLoading={saving}
        okText="Save"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="Product title"
            rules={[{ required: true, message: "Title is required" }]}
          >
            <Input placeholder="Tarpaulin & Signage Printing" />
          </Form.Item>
          <Form.Item
            name="categorySlugs"
            label="GRIDGO categories"
            rules={[{ required: true, message: "Pick at least one category" }]}
          >
            <Select
              mode="multiple"
              placeholder="Select orderable products"
              options={categories.map((c) => ({
                value: c.slug,
                label: `${c.name} (${c.slug})`,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Form>
      </Modal>
    </List>
  );
}
