// admin/src/pages/products/list.tsx
import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Switch, Button, Drawer, Form, Input, Alert,
  InputNumber, Select, Space, Tag, Divider, Spin, App, Popconfirm
} from 'antd';
import {
  EditOutlined, PlusOutlined, FileTextOutlined,
  AppstoreOutlined, SettingOutlined, ArrowRightOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { apiClient } from '@/providers/api-client';
import type { ServiceCategory } from '@/types/products';
import { formatCurrency } from '@/utils/format';
import { normalizeServiceCategories } from '@/utils/api-normalizers';
import { buildCategoryPayload, catalogAdminCategories, groupCatalogCategories } from './catalog-groups';

const { Text, Title } = Typography;

const S = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: 20, paddingBottom: 40 },
  card: { background: '#141414', border: '1px solid #2E2E2E', borderRadius: 12, overflow: 'hidden' as const },
  label: { color: '#666', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  value: { color: '#F0F0F0', fontSize: 14, fontWeight: 600 } as React.CSSProperties,
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  paper: <FileTextOutlined style={{ fontSize: 28, color: '#FFDE58' }} />,
  '3d': <AppstoreOutlined style={{ fontSize: 28, color: '#42A5F5' }} />,
};

export function ProductList() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await apiClient.get("/products/categories?include_inactive=true");
      setCategories(normalizeServiceCategories(res.data));
    } catch {
      setCategories([]);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchCategories(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    form.setFieldsValue({
      file_processing_type: 'document',
      pricing_model: 'quote_required',
      quantity_unit: 'page',
      base_rate: 0,
      max_file_size_mb: 50,
      allowed_extensions: 'pdf, png, jpg, jpeg, tif, tiff, docx',
      sort_order: categories.length + 1,
      is_active: true,
    });
    setDrawerOpen(true);
  };

  const openEdit = (cat: ServiceCategory) => {
    setEditTarget(cat);
    form.setFieldsValue({
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      mobile_description: cat.mobile_description,
      icon: cat.icon,
      group_slug: cat.group_slug,
      group_name: cat.group_name,
      group_description: cat.group_description,
      group_sort_order: cat.group_sort_order,
      examples: cat.examples?.join(', '),
      file_processing_type: cat.file_processing_type,
      pricing_model: cat.pricing_model,
      base_rate: cat.base_rate,
      quantity_unit: cat.quantity_unit,
      max_file_size_mb: cat.max_file_size_mb,
      allowed_extensions: cat.allowed_extensions.join(', '),
      sort_order: cat.sort_order,
      is_active: cat.is_active,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = { ...buildCategoryPayload(values), icon: values.icon };
      if (editTarget) {
        await apiClient.patch(`/products/categories/${editTarget.id}`, payload);
        void message.success('Category updated');
      } else {
        await apiClient.post("/products/categories", payload);
        void message.success('Category created');
      }
      setDrawerOpen(false);
      void fetchCategories();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: ServiceCategory) => {
    try {
      await apiClient.patch(`/products/categories/${cat.id}`, { isActive: !cat.is_active });
      void fetchCategories();
    } catch {
      void message.error('Failed to update status');
    }
  };

  const handleDeleteCategory = async (cat: ServiceCategory) => {
    try {
      await apiClient.delete(`/products/categories/${cat.id}`);
      void message.success('Category deleted');
      void fetchCategories();
    } catch {
      void message.error('Failed to delete category');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ color: '#F0F0F0', margin: 0, marginBottom: 2 }}>Products & Services</Title>
          <Text style={{ color: '#666', fontSize: 13 }}>Manage service categories, pricing options, and addons</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#FFDE58', borderColor: '#FFDE58', color: '#141414', fontWeight: 600 }}>
          New Category
        </Button>
      </div>

      {loadError ? (
        <Alert
          type="error"
          showIcon
          message="Unable to load catalog"
          description="The saved catalog remains unchanged. Try loading it again."
          action={<Button onClick={() => void fetchCategories()}>Retry</Button>}
        />
      ) : null}

      {/* Category Cards */}
      <Row gutter={[16, 16]}>
        {groupCatalogCategories(catalogAdminCategories(categories)).map((group) => (
          <React.Fragment key={group.slug}>
          <Col span={24}>
            <Title level={4} style={{ color: '#F0F0F0', margin: '12px 0 0' }}>{group.name}</Title>
            {group.description ? <Text style={{ color: '#808080' }}>{group.description}</Text> : null}
          </Col>
          {group.products.map((cat) => (
          <Col xs={24} sm={12} lg={8} key={cat.id}>
            <Card
              style={{ ...S.card, opacity: cat.is_active ? 1 : 0.6 }}
              styles={{ body: { padding: 20 } }}
            >
              {/* Icon + name row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ background: '#1A1A1A', borderRadius: 10, padding: 10, border: '1px solid #2E2E2E' }}>
                    {CATEGORY_ICONS[cat.slug] ?? <AppstoreOutlined style={{ fontSize: 28, color: '#808080' }} />}
                  </div>
                  <div>
                    <Text strong style={{ color: '#F0F0F0', display: 'block', fontSize: 15 }}>{cat.name}</Text>
                    <Tag style={{ marginTop: 2, fontSize: 10, borderRadius: 4, background: '#1A1A1A', borderColor: '#333', color: '#808080' }}>
                      {cat.slug}
                    </Tag>
                  </div>
                </div>
                <Switch checked={cat.is_active} size="small" onChange={() => handleToggleActive(cat)} />
              </div>

              <Text style={{ color: '#666', fontSize: 12, display: 'block', marginBottom: 16, lineHeight: 1.5 }}>
                {cat.description ?? '—'}
              </Text>

              <Divider style={{ borderColor: '#2E2E2E', margin: '0 0 14px' }} />

              {/* Stats grid */}
              <Row gutter={[12, 10]}>
                <Col span={12}>
                  <Text style={S.label}>Base Rate</Text>
                  <Text style={{ ...S.value, color: '#34d399', display: 'block' }}>
                    {cat.pricing_model === 'quote_required' ? 'Quote required' : `${formatCurrency(cat.base_rate)}/${cat.quantity_unit}`}
                  </Text>
                </Col>
                <Col span={12}>
                  <Text style={S.label}>Max File</Text>
                  <Text style={{ ...S.value, display: 'block' }}>{cat.max_file_size_mb} MB</Text>
                </Col>
                <Col span={12}>
                  <Text style={S.label}>Processing</Text>
                  <Text style={{ ...S.value, display: 'block', fontSize: 12 }}>{cat.file_processing_type.replace(/_/g, ' ')}</Text>
                </Col>
                <Col span={12}>
                  <Text style={S.label}>Pricing</Text>
                  <Text style={{ ...S.value, display: 'block', fontSize: 12 }}>{cat.pricing_model.replace(/_/g, ' ')}</Text>
                </Col>
                <Col span={24}>
                  <Text style={S.label}>File Types</Text>
                  <div style={{ marginTop: 4 }}>
                    {cat.allowed_extensions.map((ext) => (
                      <Tag key={ext} style={{ fontSize: 10, background: '#1A1A1A', borderColor: '#333', color: '#A0A0A0', marginBottom: 2 }}>
                        .{ext}
                      </Tag>
                    ))}
                  </div>
                </Col>
              </Row>

              <Divider style={{ borderColor: '#2E2E2E', margin: '14px 0 12px' }} />

              {/* Action buttons */}
              <Space size={8} style={{ width: '100%', display: 'flex' }}>
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(cat)}
                  style={{ background: '#1A1A1A', borderColor: '#333', color: '#F0F0F0', flex: 1 }}>
                  Edit
                </Button>
                <Button size="small" icon={<SettingOutlined />}
                  onClick={() => navigate(`/products/${cat.id}/options`)}
                  style={{ background: '#1A1A1A', borderColor: '#333', color: '#F0F0F0', flex: 1 }}>
                  Spec Options
                </Button>
                <Button size="small" icon={<ArrowRightOutlined />}
                  onClick={() => navigate(`/products-addons?category_id=${cat.id}`)}
                  style={{ background: '#1A1A1A', borderColor: '#333', color: '#F0F0F0', flex: 1 }}>
                  Addons
                </Button>
                <Popconfirm
                  title="Delete Category"
                  description="Are you sure you want to delete this category?"
                  onConfirm={() => handleDeleteCategory(cat)}
                  okText="Yes"
                  cancelText="No"
                  placement="topRight"
                >
                  <Button size="small" danger icon={<DeleteOutlined />} style={{ background: '#1A1A1A', borderColor: '#ff4d4f', flexShrink: 0 }} />
                </Popconfirm>
              </Space>
            </Card>
          </Col>
          ))}
          </React.Fragment>
        ))}
      </Row>

      {/* Create/Edit Drawer */}
      <Drawer
        title={<Text style={{ color: '#F0F0F0', fontWeight: 600 }}>{editTarget ? 'Edit Category' : 'New Category'}</Text>}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={440}
        extra={
          <Button type="primary" loading={saving} onClick={handleSave}
            style={{ background: '#FFDE58', borderColor: '#FFDE58', color: '#141414', fontWeight: 600 }}>
            Save
          </Button>
        }
        styles={{ body: { background: '#141414' }, header: { background: '#141414', borderBottom: '1px solid #2E2E2E' }, footer: { background: '#141414' } }}
      >
        <Form form={form} layout="vertical">
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Name</Text>} name="name" rules={[{ required: true }]}>
            <Input placeholder="Paper Printing" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Slug</Text>} name="slug"
            rules={[{ required: true }, { pattern: /^[a-z0-9-]+$/, message: 'Lowercase alphanumeric + hyphens only' }]}>
            <Input placeholder="paper" disabled={!!editTarget} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Description</Text>} name="description">
            <Input.TextArea rows={2} placeholder="Short description..." />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Mobile Description</Text>} name="mobile_description">
            <Input.TextArea rows={2} maxLength={160} placeholder="Short customer-facing description..." />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Icon (Ant Design icon name)</Text>} name="icon">
            <Input placeholder="FileTextOutlined" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Group slug</Text>} name="group_slug">
            <Input placeholder="marketing-promo" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Group name</Text>} name="group_name">
            <Input placeholder="Marketing & Promotional Collateral" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Group description</Text>} name="group_description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Group order</Text>} name="group_sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Examples (comma separated)</Text>} name="examples">
            <Input />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>File Processing</Text>} name="file_processing_type" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'document', label: 'Document / paper' },
                { value: 'model_3d', label: '3D model' },
                { value: 'generic_file', label: 'Generic file' },
              ]}
            />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Pricing Model</Text>} name="pricing_model" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'per_page_modifiers', label: 'Per page + spec modifiers' },
                { value: 'base_plus_material_estimate', label: 'Base + material estimate' },
                { value: 'quote_required', label: 'Quote required (RFQ)' },
              ]}
            />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Base Rate (₱)</Text>} name="base_rate" rules={[{ required: true }]}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="₱" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Quantity Unit</Text>} name="quantity_unit" rules={[{ required: true }]}>
            <Input placeholder="page, gram, copy" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Max File Size (MB)</Text>} name="max_file_size_mb" rules={[{ required: true }]}>
            <InputNumber min={1} max={500} style={{ width: '100%' }} addonAfter="MB" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Allowed Extensions</Text>} name="allowed_extensions"
            rules={[{ required: true }]}
            help={<Text style={{ color: '#555', fontSize: 11 }}>Comma-separated: pdf, png, jpg, tif, tiff</Text>}>
            <Input placeholder="pdf, png, jpg, jpeg" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Sort Order</Text>} name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Active</Text>} name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
