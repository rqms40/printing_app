import { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, InputNumber, Switch,
  Select, Space, Typography, Tag, Spin, App,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { mockAddons, mockCategories } from '@/providers/mock-data';
import { apiClient } from '@/providers/api-client';
import type { ServiceAddon, ServiceCategory } from '@/types/products';
import { formatCurrency } from '@/utils/format';
import {
  normalizeServiceAddons,
  normalizeServiceCategories,
} from '@/utils/api-normalizers';

const { Text, Title } = Typography;

export function AddonList() {
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('category_id');
  const { message, modal } = App.useApp();
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ServiceAddon | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    try {
      const [addonRes, catRes] = await Promise.all([
        apiClient.get(`/products/addons${categoryId ? `?category_id=${categoryId}` : ''}`),
        apiClient.get("/products/categories"),
      ]);
      setAddons(normalizeServiceAddons(addonRes.data));
      setCategories(normalizeServiceCategories(catRes.data));
    } catch {
      setAddons(mockAddons);
      setCategories(mockCategories);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, [categoryId]);

  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    if (categoryId) form.setFieldValue('categoryId', Number(categoryId));
    setModalOpen(true);
  };

  const openEdit = (addon: ServiceAddon) => {
    setEditTarget(addon);
    form.setFieldsValue({
      categoryId: addon.category_id ? Number(addon.category_id) : null,
      name: addon.name,
      description: addon.description,
      price: addon.price,
      priceType: addon.price_type,
      sortOrder: addon.sort_order,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editTarget) {
        await apiClient.patch(`/products/addons/${editTarget.id}`, values);
        void message.success('Addon updated');
      } else {
        await apiClient.post("/products/addons", values);
        void message.success('Addon created');
      }
      setModalOpen(false);
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (addon: ServiceAddon) => {
    modal.confirm({
      title: `Delete "${addon.name}"?`,
      content: 'This cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/products/addons/${addon.id}`);
          void message.success('Addon deleted');
          void fetchData();
        } catch (err: unknown) {
          if (axios.isAxiosError(err)) {
            void message.error(err.response?.data?.message ?? 'Delete failed');
          }
        }
      },
    });
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ color: '#F0F0F0', margin: 0, marginBottom: 2 }}>Service Addons</Title>
          <Text style={{ color: '#666', fontSize: 13 }}>Optional extras customers can add to their orders</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#FFDE58', borderColor: '#FFDE58', color: '#141414', fontWeight: 600 }}>
          New Addon
        </Button>
      </div>

      <div className="riders-table-section">
        <Table
          dataSource={addons}
          rowKey="id"
          size="middle"
          pagination={false}
          scroll={{ x: 640 }}
        >
          <Table.Column
            title="Name"
            width={200}
            render={(_: unknown, record: ServiceAddon) => (
              <div>
                <Text strong style={{ color: '#F0F0F0', display: 'block', fontSize: 13.5 }}>{record.name}</Text>
                {record.description && (
                  <Text style={{ color: '#666', fontSize: 11.5 }}>{record.description}</Text>
                )}
              </div>
            )}
          />
          <Table.Column
            title="Category"
            width={140}
            render={(_: unknown, record: ServiceAddon) => {
              if (!record.category_id) return <Tag style={{ background: '#1A1A1A', borderColor: '#333', color: '#808080' }}>All categories</Tag>;
              const cat = categories.find((c) => c.id === record.category_id);
              return <Tag style={{ background: '#1A1A1A', borderColor: '#333', color: '#A0A0A0' }}>{cat?.name ?? record.category_id}</Tag>;
            }}
          />
          <Table.Column
            title="Price"
            width={120}
            render={(_: unknown, record: ServiceAddon) => (
              <Text style={{ color: '#34d399', fontWeight: 600 }}>{formatCurrency(record.price)}</Text>
            )}
          />
          <Table.Column
            title="Price Type"
            width={110}
            render={(_: unknown, record: ServiceAddon) => (
              record.price_type === 'flat'
                ? <Tag style={{ background: '#1A1A1A', borderColor: '#444', color: '#A0A0A0' }}>Flat Fee</Tag>
                : <Tag style={{ background: '#1A1A1A', borderColor: '#444', color: '#A0A0A0' }}>Per Unit</Tag>
            )}
          />
          <Table.Column
            dataIndex="is_active"
            title="Active"
            width={80}
            render={(v: boolean, record: ServiceAddon) => (
              <Switch
                checked={v}
                size="small"
                onChange={async (checked) => {
                  try {
                    await apiClient.patch(`/products/addons/${record.id}`, { isActive: checked });
                    void fetchData();
                  } catch {
                    void message.error('Update failed');
                  }
                }}
              />
            )}
          />
          <Table.Column
            title=""
            width={80}
            render={(_: unknown, record: ServiceAddon) => (
              <Space size={4}>
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}
                  style={{ color: '#808080' }} />
                <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => handleDelete(record)}
                  style={{ color: '#555' }} />
              </Space>
            )}
          />
        </Table>
      </div>

      <Modal
        title={<Text style={{ color: '#F0F0F0' }}>{editTarget ? 'Edit Addon' : 'New Addon'}</Text>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        styles={{ content: { background: '#1E1E1E' }, header: { background: '#1E1E1E', borderBottom: '1px solid #2E2E2E' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Name</Text>} name="name" rules={[{ required: true }]}>
            <Input placeholder="Lamination" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Description</Text>} name="description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Category (leave blank for all)</Text>} name="categoryId">
            <Select allowClear placeholder="All categories">
              {categories.map((c) => (
                <Select.Option key={c.id} value={Number(c.id)}>{c.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Price (₱)</Text>} name="price" rules={[{ required: true }]}>
            <InputNumber min={0.01} step={5} precision={2} style={{ width: '100%' }} prefix="₱" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Price Type</Text>} name="priceType" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="flat">Flat fee (once per order)</Select.Option>
              <Select.Option value="per_unit">Per unit</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Sort Order</Text>} name="sortOrder" initialValue={99}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
