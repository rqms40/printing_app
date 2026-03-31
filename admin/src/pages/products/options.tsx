// admin/src/pages/products/options.tsx
import { useState, useEffect } from 'react';
import {
  Tabs, Table, Button, Modal, Form, Input, InputNumber,
  Switch, Space, Typography, Spin, Breadcrumb, Tag, App,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, HomeOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { mockCategories, mockSpecOptions } from '@/providers/mock-data';
import { apiClient } from '@/providers/api-client';
import type { ServiceCategory, SpecOption } from '@/types/products';
import {
  normalizeServiceCategory,
  normalizeSpecOptions,
} from '@/utils/api-normalizers';

const { Text } = Typography;

// Groups that have a fixed_fee (bindings)
const FEE_GROUPS = new Set(['binding']);
// Groups that have a unit_cost (materials)
const COST_GROUPS = new Set(['material']);
// Groups that have estimated_grams (infill)
const GRAM_GROUPS = new Set(['infill']);

export function ProductOptionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [options, setOptions] = useState<SpecOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    try {
      const [catRes, optRes] = await Promise.all([
        apiClient.get(`/products/categories/${id!}`),
        apiClient.get(`/products/options?category_id=${id!}`),
      ]);
      setCategory(normalizeServiceCategory(catRes.data));
      setOptions(normalizeSpecOptions(optRes.data));
    } catch {
      const cat = mockCategories.find((c) => c.id === id) ?? null;
      setCategory(cat);
      setOptions(mockSpecOptions.filter((o) => o.category_id === id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, [id]);

  const groups = [...new Set(options.map((o) => o.option_group))].sort();

  const handleToggleActive = async (opt: SpecOption) => {
    try {
      await apiClient.patch(`/products/options/${opt.id}`, { isActive: !opt.is_active });
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Update failed');
      }
    }
  };

  const handleInlineEdit = async (opt: SpecOption, field: keyof SpecOption, value: unknown) => {
    try {
      const key = field === 'option_group' ? 'optionGroup'
        : field === 'fixed_fee' ? 'fixedFee'
        : field === 'unit_cost' ? 'unitCost'
        : field === 'is_default' ? 'isDefault'
        : field === 'is_active' ? 'isActive'
        : field === 'sort_order' ? 'sortOrder'
        : field === 'estimated_grams' ? 'estimatedGrams'
        : field;
      await apiClient.patch(`/products/options/${opt.id}`, { [key]: value });
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Update failed');
      }
    }
  };

  const handleDelete = (opt: SpecOption) => {
    modal.confirm({
      title: `Delete "${opt.label}"?`,
      content: 'This cannot be undone.',
      okText: 'Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/products/options/${opt.id}`);
          void message.success('Option deleted');
          void fetchData();
        } catch (err: unknown) {
          if (axios.isAxiosError(err)) {
            void message.error(err.response?.data?.message ?? 'Delete failed');
          }
        }
      },
    });
  };

  const openAddModal = (group: string) => {
    setActiveGroup(group);
    form.resetFields();
    form.setFieldValue('optionGroup', group);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await apiClient.post("/products/options", {
        ...values,
        categoryId: Number(id),
      });
      void message.success('Option added');
      setModalOpen(false);
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Create failed');
      }
      // form.validateFields() rejection is handled inline by Ant Design — no extra message needed
    } finally {
      setSaving(false);
    }
  };

  const columns = (group: string) => [
    {
      title: 'Label',
      dataIndex: 'label',
      width: 140,
      render: (label: string, record: SpecOption) => (
        <Text
          editable={{ onChange: (v) => handleInlineEdit(record, 'label', v), triggerType: ['text'] }}
          style={{ color: '#F0F0F0', fontSize: 13 }}
        >
          {label}
        </Text>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      width: 120,
      render: (v: string) => <Text style={{ color: '#808080', fontSize: 12, fontFamily: 'monospace' }}>{v}</Text>,
    },
    {
      title: 'Multiplier',
      dataIndex: 'multiplier',
      width: 100,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0.001}
          step={0.1}
          precision={3}
          defaultValue={v}
          style={{ width: 80 }}
          onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) handleInlineEdit(record, 'multiplier', v); }}
        />
      ),
    },
    ...(FEE_GROUPS.has(group) ? [{
      title: 'Fee (₱)',
      dataIndex: 'fixed_fee',
      width: 90,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0}
          step={5}
          precision={2}
          defaultValue={v}
          style={{ width: 75 }}
          onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) handleInlineEdit(record, 'fixed_fee', v); }}
        />
      ),
    }] : []),
    ...(COST_GROUPS.has(group) ? [{
      title: '₱/gram',
      dataIndex: 'unit_cost',
      width: 90,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0}
          step={0.5}
          precision={2}
          defaultValue={v}
          style={{ width: 75 }}
          onBlur={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) handleInlineEdit(record, 'unit_cost', v); }}
        />
      ),
    }] : []),
    ...(GRAM_GROUPS.has(group) ? [{
      title: 'Est. Grams',
      dataIndex: 'estimated_grams',
      width: 100,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={1}
          defaultValue={v}
          style={{ width: 80 }}
          onBlur={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) handleInlineEdit(record, 'estimated_grams', v); }}
        />
      ),
    }] : []),
    {
      title: 'Default',
      dataIndex: 'is_default',
      width: 70,
      render: (v: boolean, record: SpecOption) => (
        <Switch
          checked={v}
          size="small"
          onChange={(checked) => handleInlineEdit(record, 'is_default', checked)}
        />
      ),
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      width: 70,
      render: (v: boolean, record: SpecOption) => (
        <Switch checked={v} size="small" onChange={() => handleToggleActive(record)} />
      ),
    },
    {
      title: '',
      width: 40,
      render: (_: unknown, record: SpecOption) => (
        <Button
          type="text"
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDelete(record)}
          style={{ color: '#555' }}
        />
      ),
    },
  ];

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>
      <div>
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={[
            { title: <HomeOutlined onClick={() => navigate('/products')} style={{ cursor: 'pointer', color: '#666' }} /> },
            { title: <Text style={{ color: '#666', cursor: 'pointer' }} onClick={() => navigate('/products')}>Products</Text> },
            { title: <Text style={{ color: '#F0F0F0' }}>{category?.name ?? 'Spec Options'}</Text> },
          ]}
        />
        <Text style={{ color: '#F0F0F0', fontSize: 20, fontWeight: 700, display: 'block' }}>
          Spec Options — {category?.name}
        </Text>
        <Text style={{ color: '#666', fontSize: 13 }}>
          Edit pricing multipliers and toggle options. Changes are saved on field blur.
        </Text>
      </div>

      <div className="drivers-table-section">
        <Tabs
          style={{ padding: '0 4px' }}
          tabBarStyle={{ padding: '0 16px', borderBottom: '1px solid #2E2E2E', marginBottom: 0 }}
          items={groups.map((group) => {
            const groupOptions = options.filter((o) => o.option_group === group);
            return {
              key: group,
              label: (
                <Space size={6}>
                  <span style={{ textTransform: 'capitalize' }}>{group.replace(/_/g, ' ')}</span>
                  <Tag style={{ fontSize: 10, background: '#1A1A1A', borderColor: '#333', color: '#808080', margin: 0 }}>
                    {groupOptions.length}
                  </Tag>
                </Space>
              ),
              children: (
                <div>
                  <Table
                    dataSource={groupOptions}
                    rowKey="id"
                    columns={columns(group)}
                    size="small"
                    pagination={false}
                    scroll={{ x: 480 }}
                  />
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #1A1A1A' }}>
                    <Button
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => openAddModal(group)}
                      style={{ borderColor: '#333', color: '#FFDE58', background: 'transparent' }}
                    >
                      Add {group.replace(/_/g, ' ')} option
                    </Button>
                  </div>
                </div>
              ),
            };
          })}
        />
      </div>

      {/* Add Option Modal */}
      <Modal
        title={<Text style={{ color: '#F0F0F0' }}>Add {activeGroup.replace(/_/g, ' ')} option</Text>}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="Add"
        confirmLoading={saving}
        styles={{ content: { background: '#1E1E1E' }, header: { background: '#1E1E1E', borderBottom: '1px solid #2E2E2E' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="optionGroup" hidden><Input /></Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Label</Text>} name="label" rules={[{ required: true }]}>
            <Input placeholder="e.g. A3" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Value (slug)</Text>} name="value"
            rules={[{ required: true }, { pattern: /^[a-z0-9_]+$/, message: 'Lowercase letters, numbers, underscores' }]}>
            <Input placeholder="e.g. a3" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Multiplier</Text>} name="multiplier" initialValue={1.0}>
            <InputNumber min={0.001} step={0.1} precision={3} style={{ width: '100%' }} />
          </Form.Item>
          {FEE_GROUPS.has(activeGroup) && (
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Fixed Fee (₱)</Text>} name="fixedFee" initialValue={0}>
              <InputNumber min={0} step={5} precision={2} style={{ width: '100%' }} prefix="₱" />
            </Form.Item>
          )}
          {COST_GROUPS.has(activeGroup) && (
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Cost per Gram (₱)</Text>} name="unitCost" initialValue={0}>
              <InputNumber min={0} step={0.5} precision={2} style={{ width: '100%' }} prefix="₱" />
            </Form.Item>
          )}
          {GRAM_GROUPS.has(activeGroup) && (
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Estimated Grams</Text>} name="estimatedGrams">
              <InputNumber min={1} style={{ width: '100%' }} addonAfter="g" />
            </Form.Item>
          )}
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Sort Order</Text>} name="sortOrder" initialValue={99}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
