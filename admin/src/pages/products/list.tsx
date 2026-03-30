// admin/src/pages/products/list.tsx
import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Typography, Switch, Button, Drawer, Form, Input,
  InputNumber, Space, Tag, Divider, Spin, App,
} from 'antd';
import {
  EditOutlined, PlusOutlined, FileTextOutlined,
  AppstoreOutlined, SettingOutlined, ArrowRightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '@/config/constants';
import { mockCategories } from '@/providers/mock-data';
import type { ServiceCategory } from '@/types/products';
import { formatCurrency } from '@/utils/format';

const { Text, Title } = Typography;

const S = {
  page: { display: 'flex', flexDirection: 'column' as const, gap: 20, paddingBottom: 40 },
  card: { background: '#141414', border: '1px solid #2E2E2E', borderRadius: 12, overflow: 'hidden' as const },
  label: { color: '#666', fontSize: 11, fontWeight: 500, textTransform: 'uppercase' as const, letterSpacing: '0.5px' } as React.CSSProperties,
  value: { color: '#F0F0F0', fontSize: 14, fontWeight: 600 } as React.CSSProperties,
};

const axiosInstance = axios.create();
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('grid_admin_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  paper: <FileTextOutlined style={{ fontSize: 28, color: '#FFDE58' }} />,
  '3d': <AppstoreOutlined style={{ fontSize: 28, color: '#42A5F5' }} />,
};

export function ProductList() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceCategory | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchCategories = async () => {
    try {
      const res = await axiosInstance.get<ServiceCategory[]>(`${API_URL}/products/categories?include_inactive=true`);
      setCategories(res.data);
    } catch {
      setCategories(mockCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchCategories(); }, []);

  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    setDrawerOpen(true);
  };

  const openEdit = (cat: ServiceCategory) => {
    setEditTarget(cat);
    form.setFieldsValue({
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      base_rate: cat.base_rate,
      max_file_size_mb: cat.max_file_size_mb,
      allowed_extensions: cat.allowed_extensions.join(', '),
      sort_order: cat.sort_order,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        allowedExtensions: JSON.stringify(
          (values.allowed_extensions as string).split(',').map((e: string) => e.trim().toLowerCase()),
        ),
        baseRate: values.base_rate,
        maxFileSizeMb: values.max_file_size_mb,
        sortOrder: values.sort_order ?? 0,
      };
      if (editTarget) {
        await axiosInstance.patch(`${API_URL}/products/categories/${editTarget.id}`, payload);
        void message.success('Category updated');
      } else {
        await axiosInstance.post(`${API_URL}/products/categories`, payload);
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
      await axiosInstance.patch(`${API_URL}/products/categories/${cat.id}`, { isActive: !cat.is_active });
      void fetchCategories();
    } catch {
      void message.error('Failed to update status');
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

      {/* Category Cards */}
      <Row gutter={[16, 16]}>
        {categories.map((cat) => (
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
                  <Text style={{ ...S.value, color: '#34d399', display: 'block' }}>{formatCurrency(cat.base_rate)}/{cat.slug === '3d' ? 'gram' : 'page'}</Text>
                </Col>
                <Col span={12}>
                  <Text style={S.label}>Max File</Text>
                  <Text style={{ ...S.value, display: 'block' }}>{cat.max_file_size_mb} MB</Text>
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
              <Space size={8} style={{ width: '100%' }}>
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
              </Space>
            </Card>
          </Col>
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
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Icon (Ant Design icon name)</Text>} name="icon">
            <Input placeholder="FileTextOutlined" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Base Rate (₱)</Text>} name="base_rate" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} prefix="₱" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Max File Size (MB)</Text>} name="max_file_size_mb" rules={[{ required: true }]}>
            <InputNumber min={1} max={500} style={{ width: '100%' }} addonAfter="MB" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Allowed Extensions</Text>} name="allowed_extensions"
            rules={[{ required: true }]}
            help={<Text style={{ color: '#555', fontSize: 11 }}>Comma-separated: pdf, png, jpg</Text>}>
            <Input placeholder="pdf, png, jpg, jpeg" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Sort Order</Text>} name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
