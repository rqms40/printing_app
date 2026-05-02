// admin/src/pages/products/options.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  App,
  Breadcrumb,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  DeleteOutlined,
  HomeOutlined,
  PlusOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { mockCategories, mockSpecOptions } from '@/providers/mock-data';
import { apiClient } from '@/providers/api-client';
import type {
  ProductPricingRole,
  ProductSpecDefinition,
  ServiceCategory,
  SpecOption,
} from '@/types/products';
import {
  normalizeProductSpecDefinitions,
  normalizeServiceCategory,
  normalizeSpecOptions,
} from '@/utils/api-normalizers';

const { Text } = Typography;

const EMPTY_DATE = '1970-01-01T00:00:00.000Z';

const PRICING_ROLE_LABELS: Record<ProductPricingRole, string> = {
  none: 'No pricing',
  multiplier: 'Multiplier',
  fixed_fee: 'Fixed fee',
  unit_cost: 'Unit cost',
  estimated_quantity: 'Estimated quantity',
};

const INPUT_TYPE_OPTIONS = [
  { value: 'select', label: 'Select options' },
  { value: 'number', label: 'Number input' },
  { value: 'boolean', label: 'Boolean toggle' },
  { value: 'text', label: 'Text input' },
];

const VALUE_TYPE_OPTIONS = [
  { value: 'string', label: 'Text value' },
  { value: 'number', label: 'Numeric value' },
  { value: 'boolean', label: 'Boolean value' },
];

const PRICING_ROLE_OPTIONS = [
  { value: 'none', label: 'No pricing' },
  { value: 'multiplier', label: 'Multiplier' },
  { value: 'fixed_fee', label: 'Fixed fee' },
  { value: 'unit_cost', label: 'Unit cost' },
  { value: 'estimated_quantity', label: 'Estimated quantity' },
];

function titleize(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function fallbackPricingRole(group: string): ProductPricingRole {
  if (group === 'binding') return 'fixed_fee';
  if (group === 'material') return 'unit_cost';
  if (group === 'infill') return 'estimated_quantity';
  return 'multiplier';
}

function fallbackSpec(categoryId: string, key: string, index: number): ProductSpecDefinition {
  return {
    id: `fallback-${key}`,
    category_id: categoryId,
    key,
    label: titleize(key),
    input_type: 'select',
    value_type: 'string',
    is_required: true,
    is_active: true,
    pricing_role: fallbackPricingRole(key),
    sort_order: index,
    options: [],
    created_at: EMPTY_DATE,
    updated_at: EMPTY_DATE,
  };
}

function apiOptionField(field: keyof SpecOption) {
  if (field === 'fixed_fee') return 'fixedFee';
  if (field === 'unit_cost') return 'unitCost';
  if (field === 'is_default') return 'isDefault';
  if (field === 'is_active') return 'isActive';
  if (field === 'sort_order') return 'sortOrder';
  if (field === 'estimated_grams' || field === 'estimated_quantity') {
    return 'estimatedQuantity';
  }
  if (field === 'spec_definition_id') return 'specDefinitionId';
  return field;
}

function isPersistedId(id: string) {
  return id.trim().length > 0 && Number.isFinite(Number(id));
}

export function ProductOptionsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [specs, setSpecs] = useState<ProductSpecDefinition[]>([]);
  const [options, setOptions] = useState<SpecOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionModalOpen, setOptionModalOpen] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [activeSpec, setActiveSpec] = useState<ProductSpecDefinition | null>(null);
  const [editingSpec, setEditingSpec] = useState<ProductSpecDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [optionForm] = Form.useForm();
  const [specForm] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const [catRes, specRes, optRes] = await Promise.all([
        apiClient.get(`/products/categories/${id!}`),
        apiClient.get(`/products/spec-definitions?category_id=${id!}`),
        apiClient.get(`/products/options?category_id=${id!}`),
      ]);
      setCategory(normalizeServiceCategory(catRes.data));
      setSpecs(normalizeProductSpecDefinitions(specRes.data));
      setOptions(normalizeSpecOptions(optRes.data));
    } catch {
      const cat = mockCategories.find((c) => c.id === id) ?? null;
      const fallbackOptions = mockSpecOptions.filter((o) => o.category_id === id);
      const groups = [...new Set(fallbackOptions.map((o) => o.option_group))];
      setCategory(cat);
      setSpecs(groups.map((group, index) => fallbackSpec(id ?? '', group, index)));
      setOptions(fallbackOptions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, [id]);

  const visibleSpecs = useMemo(() => {
    const byKey = new Map<string, ProductSpecDefinition>();
    specs.forEach((spec) => byKey.set(spec.key, spec));
    options.forEach((option) => {
      if (!byKey.has(option.option_group)) {
        byKey.set(
          option.option_group,
          fallbackSpec(option.category_id, option.option_group, byKey.size),
        );
      }
    });
    return [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order || a.key.localeCompare(b.key));
  }, [options, specs]);

  const handleSpecPatch = async (
    spec: ProductSpecDefinition,
    patch: Record<string, unknown>,
  ) => {
    if (!isPersistedId(spec.id)) {
      void message.warning('Spec settings are unavailable while using mock data.');
      return;
    }

    try {
      await apiClient.patch(`/products/spec-definitions/${spec.id}`, patch);
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Update failed');
      }
    }
  };

  const handleToggleOptionActive = async (opt: SpecOption) => {
    try {
      await apiClient.patch(`/products/spec-options/${opt.id}`, { isActive: !opt.is_active });
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Update failed');
      }
    }
  };

  const handleInlineEdit = async (opt: SpecOption, field: keyof SpecOption, value: unknown) => {
    try {
      await apiClient.patch(`/products/spec-options/${opt.id}`, { [apiOptionField(field)]: value });
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
      content: 'This cannot be undone. Disable the option instead if existing orders still need its pricing snapshot.',
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

  const openAddOptionModal = (spec: ProductSpecDefinition) => {
    setActiveSpec(spec);
    optionForm.resetFields();
    optionForm.setFieldsValue({
      multiplier: 1,
      fixedFee: 0,
      unitCost: 0,
      isDefault: false,
      isActive: true,
      sortOrder: 99,
    });
    setOptionModalOpen(true);
  };

  const handleCreateOption = async () => {
    if (!activeSpec || !isPersistedId(activeSpec.id)) {
      void message.warning('Create a saved spec before adding options.');
      return;
    }

    try {
      const values = await optionForm.validateFields();
      setSaving(true);
      await apiClient.post('/products/spec-options', {
        ...values,
        specDefinitionId: Number(activeSpec.id),
      });
      void message.success('Option added');
      setOptionModalOpen(false);
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Create failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const openCreateSpecModal = () => {
    setEditingSpec(null);
    specForm.resetFields();
    specForm.setFieldsValue({
      inputType: 'select',
      valueType: 'string',
      pricingRole: 'none',
      isRequired: true,
      isActive: true,
      sortOrder: visibleSpecs.length * 10 + 10,
    });
    setSpecModalOpen(true);
  };

  const openEditSpecModal = (spec: ProductSpecDefinition) => {
    setEditingSpec(spec);
    specForm.resetFields();
    specForm.setFieldsValue({
      key: spec.key,
      label: spec.label,
      helpText: spec.help_text,
      inputType: spec.input_type,
      valueType: spec.value_type,
      isRequired: spec.is_required,
      isActive: spec.is_active,
      defaultValue: spec.default_value,
      pricingRole: spec.pricing_role,
      unitLabel: spec.unit_label,
      placeholder: spec.placeholder,
      minValue: spec.min_value,
      maxValue: spec.max_value,
      stepValue: spec.step_value,
      sortOrder: spec.sort_order,
    });
    setSpecModalOpen(true);
  };

  const handleSaveSpec = async () => {
    try {
      const values = await specForm.validateFields();
      setSaving(true);
      if (editingSpec) {
        await apiClient.patch(`/products/spec-definitions/${editingSpec.id}`, values);
        void message.success('Spec updated');
      } else {
        await apiClient.post('/products/spec-definitions', {
          ...values,
          categoryId: Number(id),
        });
        void message.success('Spec created');
      }
      setSpecModalOpen(false);
      void fetchData();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        void message.error(err.response?.data?.message ?? 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const columns = (spec: ProductSpecDefinition) => [
    {
      title: 'Label',
      dataIndex: 'label',
      width: 150,
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
      width: 130,
      render: (v: string) => <Text style={{ color: '#808080', fontSize: 12, fontFamily: 'monospace' }}>{v}</Text>,
    },
    {
      title: 'Multiplier',
      dataIndex: 'multiplier',
      width: 105,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0.001}
          step={0.1}
          precision={3}
          defaultValue={v}
          style={{ width: 84 }}
          onBlur={(e) => { const next = parseFloat(e.target.value); if (!Number.isNaN(next)) void handleInlineEdit(record, 'multiplier', next); }}
        />
      ),
    },
    ...(spec.pricing_role === 'fixed_fee' ? [{
      title: 'Fee (₱)',
      dataIndex: 'fixed_fee',
      width: 95,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0}
          step={5}
          precision={2}
          defaultValue={v}
          style={{ width: 78 }}
          onBlur={(e) => { const next = parseFloat(e.target.value); if (!Number.isNaN(next)) void handleInlineEdit(record, 'fixed_fee', next); }}
        />
      ),
    }] : []),
    ...(spec.pricing_role === 'unit_cost' ? [{
      title: `₱/${spec.unit_label ?? 'unit'}`,
      dataIndex: 'unit_cost',
      width: 95,
      render: (v: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0}
          step={0.5}
          precision={2}
          defaultValue={v}
          style={{ width: 78 }}
          onBlur={(e) => { const next = parseFloat(e.target.value); if (!Number.isNaN(next)) void handleInlineEdit(record, 'unit_cost', next); }}
        />
      ),
    }] : []),
    ...(spec.pricing_role === 'estimated_quantity' ? [{
      title: `Estimate${spec.unit_label ? ` (${spec.unit_label})` : ''}`,
      dataIndex: 'estimated_quantity',
      width: 115,
      render: (_: number, record: SpecOption) => (
        <InputNumber
          size="small"
          min={0}
          step={1}
          precision={2}
          defaultValue={record.estimated_quantity ?? record.estimated_grams}
          style={{ width: 88 }}
          onBlur={(e) => { const next = parseFloat(e.target.value); if (!Number.isNaN(next)) void handleInlineEdit(record, 'estimated_quantity', next); }}
        />
      ),
    }] : []),
    {
      title: 'Default',
      dataIndex: 'is_default',
      width: 78,
      render: (v: boolean, record: SpecOption) => (
        <Switch
          checked={v}
          size="small"
          onChange={(checked) => void handleInlineEdit(record, 'is_default', checked)}
        />
      ),
    },
    {
      title: 'Visible',
      dataIndex: 'is_active',
      width: 78,
      render: (v: boolean, record: SpecOption) => (
        <Switch checked={v} size="small" onChange={() => void handleToggleOptionActive(record)} />
      ),
    },
    {
      title: '',
      width: 44,
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
            { title: <Text style={{ color: '#F0F0F0' }}>{category?.name ?? 'Specs'}</Text> },
          ]}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <Text style={{ color: '#F0F0F0', fontSize: 20, fontWeight: 700, display: 'block' }}>
              Product Specs — {category?.name}
            </Text>
            <Text style={{ color: '#666', fontSize: 13 }}>
              Control which specs and values appear in mobile, and how each value affects pricing.
            </Text>
          </div>
          <Button
            icon={<PlusOutlined />}
            onClick={openCreateSpecModal}
            style={{ borderColor: '#333', color: '#FFDE58', background: 'transparent' }}
          >
            New Spec
          </Button>
        </div>
      </div>

      <div className="drivers-table-section">
        {visibleSpecs.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Empty description={<Text style={{ color: '#808080' }}>No specs configured for this product.</Text>}>
              <Button icon={<PlusOutlined />} onClick={openCreateSpecModal}>Create Spec</Button>
            </Empty>
          </div>
        ) : (
          <Tabs
            style={{ padding: '0 4px' }}
            tabBarStyle={{ padding: '0 16px', borderBottom: '1px solid #2E2E2E', marginBottom: 0 }}
            items={visibleSpecs.map((spec) => {
              const groupOptions = options.filter((o) => o.option_group === spec.key);
              const supportsOptions = spec.input_type === 'select';
              return {
                key: spec.key,
                label: (
                  <Space size={6}>
                    <span style={{ textTransform: 'capitalize', opacity: spec.is_active ? 1 : 0.55 }}>{spec.label}</span>
                    <Tag style={{ fontSize: 10, background: '#1A1A1A', borderColor: '#333', color: '#808080', margin: 0 }}>
                      {supportsOptions ? groupOptions.length : spec.input_type}
                    </Tag>
                    {!spec.is_active && (
                      <Tag style={{ fontSize: 10, background: '#2A1A1A', borderColor: '#553333', color: '#ff8a8a', margin: 0 }}>
                        hidden
                      </Tag>
                    )}
                  </Space>
                ),
                children: (
                  <div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'center',
                      padding: '12px 16px',
                      borderBottom: '1px solid #1A1A1A',
                      flexWrap: 'wrap',
                    }}>
                      <Space size={8} wrap>
                        <Tag style={{ margin: 0, background: '#1A1A1A', borderColor: '#333', color: '#A0A0A0' }}>{spec.key}</Tag>
                        <Tag style={{ margin: 0, background: '#1A1A1A', borderColor: '#333', color: '#A0A0A0' }}>{spec.input_type}</Tag>
                        <Tag style={{ margin: 0, background: '#1A1A1A', borderColor: '#333', color: '#A0A0A0' }}>{PRICING_ROLE_LABELS[spec.pricing_role]}</Tag>
                      </Space>
                      <Space size={12} wrap>
                        <Space size={6}>
                          <Text style={{ color: '#808080', fontSize: 12 }}>Required</Text>
                          <Switch
                            checked={spec.is_required}
                            size="small"
                            onChange={(checked) => void handleSpecPatch(spec, { isRequired: checked })}
                          />
                        </Space>
                        <Space size={6}>
                          <Text style={{ color: '#808080', fontSize: 12 }}>Visible</Text>
                          <Switch
                            checked={spec.is_active}
                            size="small"
                            onChange={(checked) => void handleSpecPatch(spec, { isActive: checked })}
                          />
                        </Space>
                        <Button
                          size="small"
                          icon={<SettingOutlined />}
                          onClick={() => openEditSpecModal(spec)}
                          style={{ borderColor: '#333', color: '#F0F0F0', background: 'transparent' }}
                        >
                          Settings
                        </Button>
                      </Space>
                    </div>

                    {supportsOptions ? (
                      <>
                        <Table
                          dataSource={groupOptions}
                          rowKey="id"
                          columns={columns(spec)}
                          size="small"
                          pagination={false}
                          scroll={{ x: 620 }}
                        />
                        <div style={{ padding: '12px 16px', borderTop: '1px solid #1A1A1A' }}>
                          <Button
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => openAddOptionModal(spec)}
                            style={{ borderColor: '#333', color: '#FFDE58', background: 'transparent' }}
                          >
                            Add {spec.label.toLowerCase()} option
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div style={{ padding: 24 }}>
                        <Text style={{ color: '#808080', fontSize: 13 }}>
                          This spec collects a {spec.value_type} value directly in mobile. Use settings to control defaults, bounds, and visibility.
                        </Text>
                      </div>
                    )}
                  </div>
                ),
              };
            })}
          />
        )}
      </div>

      <Modal
        title={<Text style={{ color: '#F0F0F0' }}>Add {activeSpec?.label ?? ''} option</Text>}
        open={optionModalOpen}
        onCancel={() => setOptionModalOpen(false)}
        onOk={handleCreateOption}
        okText="Add"
        confirmLoading={saving}
        styles={{ content: { background: '#1E1E1E' }, header: { background: '#1E1E1E', borderBottom: '1px solid #2E2E2E' } }}
      >
        <Form form={optionForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Label</Text>} name="label" rules={[{ required: true }]}>
            <Input placeholder="e.g. A3" />
          </Form.Item>
          <Form.Item
            label={<Text style={{ color: '#A0A0A0' }}>Value (slug)</Text>}
            name="value"
            rules={[{ required: true }, { pattern: /^[a-z0-9_]+$/, message: 'Lowercase letters, numbers, underscores' }]}
          >
            <Input placeholder="e.g. a3" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Multiplier</Text>} name="multiplier">
            <InputNumber min={0.001} step={0.1} precision={3} style={{ width: '100%' }} />
          </Form.Item>
          {activeSpec?.pricing_role === 'fixed_fee' && (
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Fixed Fee (₱)</Text>} name="fixedFee">
              <InputNumber min={0} step={5} precision={2} style={{ width: '100%' }} prefix="₱" />
            </Form.Item>
          )}
          {activeSpec?.pricing_role === 'unit_cost' && (
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Unit Cost (₱)</Text>} name="unitCost">
              <InputNumber min={0} step={0.5} precision={2} style={{ width: '100%' }} prefix="₱" />
            </Form.Item>
          )}
          {activeSpec?.pricing_role === 'estimated_quantity' && (
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Estimated Quantity</Text>} name="estimatedQuantity">
              <InputNumber min={0} step={1} precision={2} style={{ width: '100%' }} addonAfter={activeSpec.unit_label} />
            </Form.Item>
          )}
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Default</Text>} name="isDefault" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Visible</Text>} name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Sort Order</Text>} name="sortOrder">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={<Text style={{ color: '#F0F0F0' }}>{editingSpec ? 'Spec Settings' : 'New Spec'}</Text>}
        open={specModalOpen}
        onCancel={() => setSpecModalOpen(false)}
        onOk={handleSaveSpec}
        okText="Save"
        confirmLoading={saving}
        styles={{ content: { background: '#1E1E1E' }, header: { background: '#1E1E1E', borderBottom: '1px solid #2E2E2E' } }}
      >
        <Form form={specForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label={<Text style={{ color: '#A0A0A0' }}>Key</Text>}
            name="key"
            rules={[{ required: true }, { pattern: /^[a-z0-9_]+$/, message: 'Use lowercase letters, numbers, and underscores' }]}
          >
            <Input placeholder="paper_size" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Label</Text>} name="label" rules={[{ required: true }]}>
            <Input placeholder="Paper Size" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Help Text</Text>} name="helpText">
            <Input.TextArea rows={2} placeholder="Optional guidance shown near this spec" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Input Type</Text>} name="inputType" rules={[{ required: true }]}>
            <Select options={INPUT_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Value Type</Text>} name="valueType" rules={[{ required: true }]}>
            <Select options={VALUE_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Pricing Role</Text>} name="pricingRole" rules={[{ required: true }]}>
            <Select options={PRICING_ROLE_OPTIONS} />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Default Value</Text>} name="defaultValue">
            <Input placeholder="Optional default raw value" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Unit Label</Text>} name="unitLabel">
            <Input placeholder="g, mm, %" />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Placeholder</Text>} name="placeholder">
            <Input placeholder="Optional field placeholder" />
          </Form.Item>
          <Space.Compact style={{ width: '100%', marginBottom: 24 }}>
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Min</Text>} name="minValue" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Max</Text>} name="maxValue" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Step</Text>} name="stepValue" style={{ flex: 1, marginBottom: 0 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space.Compact>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Required</Text>} name="isRequired" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Visible in Mobile</Text>} name="isActive" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#A0A0A0' }}>Sort Order</Text>} name="sortOrder">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
