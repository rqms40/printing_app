import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  FileSearchOutlined,
} from '@ant-design/icons';
import { ShowPage } from '@/components/show-page';
import { StatusBadge } from '@/components/status-badge';
import {
  fetchQaWorkspace,
  submitQaDecision,
  type QaDecision,
  type QaRiskLevel,
  type QaWorkspaceDetail,
} from '@/services/qaApi';
import { formatCurrency, formatDateTime, statusLabel } from '@/utils/format';
import type { OrderStatus } from '@/types/enums';

const { Text, Title } = Typography;
const { TextArea } = Input;

const DECISION_OPTIONS: Array<{
  value: QaDecision;
  label: string;
  description: string;
  danger?: boolean;
}> = [
  {
    value: 'approved_for_matching',
    label: 'Approve for matching',
    description: 'Artwork and specs pass QA — ready for supplier matching.',
  },
  {
    value: 'needs_correction',
    label: 'Needs correction',
    description: 'Client must fix artwork or specs before re-review.',
  },
  {
    value: 'proof_required',
    label: 'Proof required',
    description: 'Hold for client proof approval before matching.',
  },
  {
    value: 'blocked',
    label: 'Block / reject file',
    description: 'Terminal file rejection — not printable as submitted.',
    danger: true,
  },
];

const CHECKLIST_LABELS: Record<string, string> = {
  product_compatibility: 'Product compatibility',
  dimensions: 'Dimensions',
  material: 'Material',
  quantity: 'Quantity',
  finish: 'Finish',
  bleed: 'Bleed',
  resolution: 'Resolution',
  color_mode: 'Color mode',
  safe_area: 'Safe area',
  deadline_realism: 'Deadline realism',
  address: 'Address',
  davao_zone_eligibility: 'Davao zone eligibility',
};

function decisionTagColor(decision: string): string {
  switch (decision) {
    case 'approved_for_matching':
      return 'green';
    case 'needs_correction':
      return 'orange';
    case 'proof_approval':
    case 'proof_required':
      return 'blue';
    case 'blocked':
      return 'red';
    default:
      return 'default';
  }
}

export function QaWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const [workspace, setWorkspace] = useState<QaWorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [decision, setDecision] = useState<QaDecision | null>(null);
  const [riskLevel, setRiskLevel] = useState<QaRiskLevel>('low');
  const [correctionRequest, setCorrectionRequest] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      message.error('Invalid order id');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchQaWorkspace(orderId);
      setWorkspace(data);
      const initial: Record<string, boolean> = {};
      for (const key of data.checklistKeys) {
        initial[key] = false;
      }
      setChecklist(initial);
      setDecision(null);
      setRiskLevel('low');
      setCorrectionRequest('');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load QA workspace';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [message, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canDecide = useMemo(
    () =>
      !!workspace &&
      workspace.allowedDecisions.length > 0 &&
      !!decision &&
      workspace.allowedDecisions.includes(decision),
    [workspace, decision],
  );

  const needsCorrectionText =
    decision === 'needs_correction' || decision === 'blocked';

  const allChecklistChecked = useMemo(() => {
    if (!workspace) return false;
    return workspace.checklistKeys.every((k) => checklist[k]);
  }, [workspace, checklist]);

  const handleSubmit = () => {
    if (!workspace || !decision) return;

    if (decision === 'needs_correction' && !correctionRequest.trim()) {
      message.warning('Correction request text is required');
      return;
    }

    const option = DECISION_OPTIONS.find((o) => o.value === decision);
    modal.confirm({
      title: `Confirm: ${option?.label ?? decision}?`,
      content: option?.description,
      okText: 'Submit decision',
      okButtonProps: { danger: option?.danger, loading: submitting },
      onOk: async () => {
        setSubmitting(true);
        try {
          const result = await submitQaDecision(orderId, {
            decision,
            checklist,
            riskLevel,
            correctionRequest: correctionRequest.trim() || undefined,
            proofRequired:
              decision === 'proof_required' || decision === 'proof_approval'
                ? true
                : undefined,
          });
          message.success(
            `QA decision recorded → ${statusLabel(result.toStatus as OrderStatus)}`,
          );
          navigate('/qa');
        } catch (err: unknown) {
          const axiosErr = err as {
            response?: { data?: { message?: string | string[] } };
            message?: string;
          };
          const raw = axiosErr.response?.data?.message ?? axiosErr.message;
          const msg = Array.isArray(raw)
            ? raw.join(', ')
            : raw || 'Decision failed';
          message.error(msg);
          throw err;
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <Alert
        type="error"
        showIcon
        message="QA workspace not found"
        action={
          <Button onClick={() => navigate('/qa')}>Back to queue</Button>
        }
      />
    );
  }

  const { order, artwork, reviews } = workspace;

  return (
    <ShowPage
      title={`QA Workspace — ${order.orderId}`}
      backTo="/qa"
      backLabel="Back to QA queue"
      contentCard={false}
      extra={
        <Link to={`/orders/show/${order.id}`}>
          <Button>Open order detail</Button>
        </Link>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Order" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Status">
                <StatusBadge status={order.orderStatus as OrderStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag>{order.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Client">
                {order.user?.fullName || '—'}
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {order.user?.email}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Qty / Total">
                {order.quantity} · {formatCurrency(order.totalPrice)}
              </Descriptions.Item>
              <Descriptions.Item label="Payment">
                {order.paymentMethod}
              </Descriptions.Item>
              <Descriptions.Item label="Delivery">
                {order.deliveryOption}
              </Descriptions.Item>
              <Descriptions.Item label="Submitted" span={2}>
                {formatDateTime(order.createdAt)}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={
              <Space>
                <FileSearchOutlined />
                Artwork
              </Space>
            }
            size="small"
            style={{ marginBottom: 16 }}
          >
            {artwork.signedUrl ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>
                  {artwork.fileName || 'Artwork file'}
                  {artwork.fileMetadataId != null && (
                    <Text type="secondary">
                      {' '}
                      (file #{artwork.fileMetadataId})
                    </Text>
                  )}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Signed URL is ops-only — suppliers never receive unapproved
                  artwork links from this gate.
                </Text>
                {/\.(png|jpe?g|webp|gif)$/i.test(artwork.fileName || '') ? (
                  <img
                    src={artwork.signedUrl}
                    alt={artwork.fileName || 'artwork'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: 360,
                      objectFit: 'contain',
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                    }}
                  />
                ) : (
                  <Button
                    type="primary"
                    href={artwork.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open signed artwork
                  </Button>
                )}
              </Space>
            ) : (
              <Alert
                type="warning"
                showIcon
                message="No signed artwork URL"
                description={
                  artwork.fileName
                    ? `File "${artwork.fileName}" has no accessible storage link.`
                    : 'This order has no file metadata attached.'
                }
              />
            )}
          </Card>

          {reviews.length > 0 && (
            <Card title="Previous reviews" size="small">
              <Timeline
                items={reviews.map((r) => ({
                  color: decisionTagColor(r.decision),
                  children: (
                    <Space direction="vertical" size={0}>
                      <Space>
                        <Tag color={decisionTagColor(r.decision)}>
                          {r.decision}
                        </Tag>
                        <Tag>{r.riskLevel}</Tag>
                        {r.proofRequired && <Tag color="blue">proof</Tag>}
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Reviewer #{r.reviewerId} · {formatDateTime(r.createdAt)}
                      </Text>
                      {r.correctionRequest && (
                        <Text>{r.correctionRequest}</Text>
                      )}
                    </Space>
                  ),
                }))}
              />
            </Card>
          )}
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title="QA decision"
            size="small"
            extra={
              workspace.allowedDecisions.length === 0 ? (
                <Tag color="default">Not in QA queue</Tag>
              ) : null
            }
          >
            {workspace.allowedDecisions.length === 0 ? (
              <Alert
                type="info"
                showIcon
                message={`Order is ${statusLabel(order.orderStatus as OrderStatus)} — no QA decision available.`}
              />
            ) : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Title level={5} style={{ marginTop: 0 }}>
                    Checklist
                  </Title>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {workspace.checklistKeys.map((key) => (
                      <Checkbox
                        key={key}
                        checked={!!checklist[key]}
                        onChange={(e) =>
                          setChecklist((prev) => ({
                            ...prev,
                            [key]: e.target.checked,
                          }))
                        }
                      >
                        {CHECKLIST_LABELS[key] || key.replace(/_/g, ' ')}
                      </Checkbox>
                    ))}
                  </Space>
                  <Button
                    type="link"
                    size="small"
                    style={{ paddingLeft: 0, marginTop: 8 }}
                    onClick={() => {
                      const next: Record<string, boolean> = {};
                      for (const k of workspace.checklistKeys) {
                        next[k] = true;
                      }
                      setChecklist(next);
                    }}
                  >
                    Mark all pass
                  </Button>
                </div>

                <div>
                  <Title level={5}>Risk level</Title>
                  <Select<QaRiskLevel>
                    value={riskLevel}
                    style={{ width: '100%' }}
                    onChange={setRiskLevel}
                    options={[
                      { value: 'low', label: 'Low' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'high', label: 'High' },
                    ]}
                  />
                </div>

                <div>
                  <Title level={5}>Decision</Title>
                  <Radio.Group
                    value={decision}
                    onChange={(e) => setDecision(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {DECISION_OPTIONS.filter((o) =>
                        workspace.allowedDecisions.includes(o.value),
                      ).map((o) => (
                        <Radio key={o.value} value={o.value}>
                          <Space>
                            {o.value === 'approved_for_matching' && (
                              <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            )}
                            {o.value === 'needs_correction' && (
                              <EditOutlined style={{ color: '#fa8c16' }} />
                            )}
                            {o.value === 'blocked' && (
                              <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                            )}
                            <span>
                              <Text strong={o.danger}>{o.label}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {o.description}
                              </Text>
                            </span>
                          </Space>
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                </div>

                {needsCorrectionText && (
                  <div>
                    <Title level={5}>
                      {decision === 'blocked'
                        ? 'Block reason'
                        : 'Correction request'}
                    </Title>
                    <TextArea
                      rows={4}
                      value={correctionRequest}
                      onChange={(e) => setCorrectionRequest(e.target.value)}
                      placeholder={
                        decision === 'blocked'
                          ? 'Why is this file blocked?'
                          : 'Tell the client exactly what to fix…'
                      }
                      maxLength={4000}
                      showCount
                    />
                  </div>
                )}

                {decision === 'approved_for_matching' && !allChecklistChecked && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Checklist incomplete"
                    description="You can still approve, but best practice is to pass every checklist item."
                  />
                )}

                <Button
                  type="primary"
                  block
                  size="large"
                  disabled={!canDecide}
                  loading={submitting}
                  danger={decision === 'blocked'}
                  onClick={handleSubmit}
                >
                  Submit QA decision
                </Button>
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </ShowPage>
  );
}
