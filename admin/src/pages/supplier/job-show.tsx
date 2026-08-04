import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Input,
  InputNumber,
  Radio,
  Row,
  Space,
  Spin,
  Tag,
  Timeline,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileSearchOutlined,
  InboxOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { ShowPage } from '@/components/show-page';
import { StatusBadge } from '@/components/status-badge';
import {
  acceptSupplierJob,
  declineSupplierJob,
  extractApiError,
  fetchSupplierJob,
  formatMinorAsCurrency,
  markSupplierReadyForPickup,
  pesosToMinor,
  submitSupplierSelfQc,
  updateSupplierProductionStatus,
  type ProductionMilestone,
  type SupplierJobDetail,
} from '@/services/supplierJobsApi';
import { formatDateTime, statusLabel } from '@/utils/format';
import type { OrderStatus } from '@/types/enums';

const { Text, Title } = Typography;
const { TextArea } = Input;

const MILESTONES: Array<{
  value: ProductionMilestone;
  label: string;
  description: string;
}> = [
  {
    value: 'materials_setup',
    label: 'Materials / setup',
    description: 'Prep materials and machine setup (starts production if needed).',
  },
  {
    value: 'in_production',
    label: 'In production',
    description: 'Actively printing / finishing.',
  },
  {
    value: 'production_complete',
    label: 'Production complete',
    description: 'Print finished — ready for self-QC evidence.',
  },
];

function hasAction(
  detail: SupplierJobDetail | null,
  action: string,
): boolean {
  return !!detail?.allowedActions?.some((a) => a === action);
}

function AcceptCountdownBanner({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const end = new Date(deadline).getTime();
  if (Number.isNaN(end)) return null;

  const remaining = end - now;
  if (remaining <= 0) {
    return (
      <Alert
        type="error"
        showIcon
        icon={<ClockCircleOutlined />}
        message="Acceptance window expired"
        description={`Deadline was ${formatDateTime(deadline)}. Decline or wait for reassignment.`}
        style={{ marginBottom: 16 }}
      />
    );
  }

  const totalSec = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const label =
    hours > 0
      ? `${hours}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
      : `${mins}m ${String(secs).padStart(2, '0')}s`;

  return (
    <Alert
      type={remaining < 2 * 60 * 60 * 1000 ? 'warning' : 'info'}
      showIcon
      icon={<ClockCircleOutlined />}
      message={`Accept within ${label}`}
      description={`Deadline: ${formatDateTime(deadline)}`}
      style={{ marginBottom: 16 }}
    />
  );
}

export function SupplierJobShowPage() {
  const { id } = useParams<{ id: string }>();
  const jobId = Number(id);
  const navigate = useNavigate();
  const { message, modal } = App.useApp();

  const [detail, setDetail] = useState<SupplierJobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Accept form
  const [pricePesos, setPricePesos] = useState<number | null>(null);
  const [promisedDate, setPromisedDate] = useState<Dayjs | null>(null);

  // Decline
  const [declineReason, setDeclineReason] = useState('');

  // Production
  const [milestone, setMilestone] =
    useState<ProductionMilestone>('materials_setup');
  const [prodNotes, setProdNotes] = useState('');

  // Self-QC
  const [selfQcNotes, setSelfQcNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<UploadFile | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(jobId) || jobId <= 0) {
      message.error('Invalid job id');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchSupplierJob(jobId);
      setDetail(data);
      // Seed price from order total if not yet committed
      if (data.assignment.finalPriceMinor == null && data.order.totalPrice) {
        setPricePesos(Number(data.order.totalPrice));
      } else if (data.assignment.finalPriceMinor != null) {
        setPricePesos(Number(data.assignment.finalPriceMinor) / 100);
      }
    } catch (err) {
      message.error(extractApiError(err));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [jobId, message]);

  useEffect(() => {
    void load();
  }, [load]);

  const canAccept = hasAction(detail, 'accept');
  const canDecline = hasAction(detail, 'decline');
  const canProduction = hasAction(detail, 'production-status');
  const canSelfQc = hasAction(detail, 'self-qc');
  const canReady = hasAction(detail, 'ready-for-pickup');

  // Live clock so Accept UI disables the moment the SLA window ends.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!canAccept || !detail?.assignment.acceptanceDeadline) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [canAccept, detail?.assignment.acceptanceDeadline]);

  const acceptDeadlineMs = detail
    ? new Date(detail.assignment.acceptanceDeadline).getTime()
    : NaN;
  const acceptDeadlinePassed =
    Number.isFinite(acceptDeadlineMs) && acceptDeadlineMs <= now;
  /** Server allows accept AND the client-side SLA window is still open. */
  const acceptWindowOpen = canAccept && !acceptDeadlinePassed;

  const pipeline = useMemo(() => {
    const status = detail?.order.orderStatus ?? '';
    const steps = [
      { key: 'supplier_assigned', label: 'Assigned' },
      { key: 'supplier_accepted', label: 'Accepted' },
      { key: 'payment_authorized', label: 'Payment authorized' },
      { key: 'production', label: 'Production' },
      { key: 'supplier_self_qc', label: 'Self-QC' },
      { key: 'ready_for_dispatch', label: 'Ready for pickup' },
    ];
    const order = [
      'supplier_assigned',
      'supplier_accepted',
      'awaiting_payment',
      'payment_authorized',
      'production',
      'supplier_self_qc',
      'ready_for_dispatch',
    ];
    const idx = order.indexOf(status);
    return steps.map((s) => {
      const sIdx = order.indexOf(s.key);
      let color: string = 'gray';
      if (s.key === status || (s.key === 'payment_authorized' && status === 'awaiting_payment')) {
        color = 'blue';
      } else if (idx >= 0 && sIdx >= 0 && sIdx < idx) {
        color = 'green';
      } else if (
        s.key === 'supplier_accepted' &&
        ['awaiting_payment', 'payment_authorized', 'production', 'supplier_self_qc', 'ready_for_dispatch'].includes(status)
      ) {
        color = 'green';
      } else if (
        s.key === 'payment_authorized' &&
        ['production', 'supplier_self_qc', 'ready_for_dispatch'].includes(status)
      ) {
        color = 'green';
      }
      return { ...s, color };
    });
  }, [detail?.order.orderStatus]);

  const handleAccept = () => {
    if (acceptDeadlinePassed) {
      message.warning('Acceptance window has expired');
      return;
    }
    if (pricePesos == null || pricePesos <= 0) {
      message.warning('Enter a final price in pesos');
      return;
    }
    if (!promisedDate) {
      message.warning('Select a promised ready date');
      return;
    }
    const finalPriceMinor = pesosToMinor(pricePesos);
    modal.confirm({
      title: 'Accept this job?',
      content: (
        <div>
          <p>
            Final price: <strong>₱{pricePesos.toFixed(2)}</strong> (
            {finalPriceMinor} centavos)
          </p>
          <p>
            Promised date:{' '}
            <strong>{promisedDate.format('YYYY-MM-DD HH:mm')}</strong>
          </p>
        </div>
      ),
      okText: 'Accept job',
      onOk: async () => {
        setSubmitting(true);
        try {
          const result = await acceptSupplierJob(jobId, {
            finalPriceMinor,
            promisedDate: promisedDate.toISOString(),
          });
          message.success(
            `Accepted → ${statusLabel(result.toStatus as OrderStatus)}`,
          );
          await load();
        } catch (err) {
          message.error(extractApiError(err));
          throw err;
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleDecline = () => {
    if (!declineReason.trim()) {
      message.warning('A decline reason is required');
      return;
    }
    modal.confirm({
      title: 'Decline this job?',
      content: 'The order will re-enter matching for another supplier.',
      okText: 'Decline',
      okButtonProps: { danger: true },
      onOk: async () => {
        setSubmitting(true);
        try {
          await declineSupplierJob(jobId, { reason: declineReason.trim() });
          message.success('Job declined — order re-queued for matching');
          navigate('/supplier/jobs');
        } catch (err) {
          message.error(extractApiError(err));
          throw err;
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleProduction = () => {
    modal.confirm({
      title: `Update production: ${MILESTONES.find((m) => m.value === milestone)?.label}?`,
      content: MILESTONES.find((m) => m.value === milestone)?.description,
      okText: 'Update status',
      onOk: async () => {
        setSubmitting(true);
        try {
          const result = await updateSupplierProductionStatus(jobId, {
            milestone,
            notes: prodNotes.trim() || undefined,
          });
          message.success(
            `Production updated → ${statusLabel(result.toStatus as OrderStatus)}`,
          );
          setProdNotes('');
          await load();
        } catch (err) {
          message.error(extractApiError(err));
          throw err;
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleSelfQc = () => {
    const file = evidenceFile?.originFileObj as File | undefined;
    if (!file) {
      message.warning('Attach self-QC evidence (photo or PDF)');
      return;
    }
    modal.confirm({
      title: 'Submit self-QC?',
      content: 'Evidence will be recorded and the job moves to supplier self-QC.',
      okText: 'Submit self-QC',
      onOk: async () => {
        setSubmitting(true);
        try {
          const result = await submitSupplierSelfQc(
            jobId,
            { notes: selfQcNotes.trim() || undefined },
            file,
          );
          message.success(
            `Self-QC submitted → ${statusLabel(result.toStatus as OrderStatus)}`,
          );
          setEvidenceFile(null);
          setSelfQcNotes('');
          await load();
        } catch (err) {
          message.error(extractApiError(err));
          throw err;
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const handleReady = () => {
    modal.confirm({
      title: 'Mark ready for pickup?',
      content: 'Order becomes ready for dispatch — riders can be assigned.',
      okText: 'Ready for pickup',
      onOk: async () => {
        setSubmitting(true);
        try {
          const result = await markSupplierReadyForPickup(jobId);
          message.success(
            `Ready for pickup → ${statusLabel(result.toStatus as OrderStatus)}`,
          );
          await load();
        } catch (err) {
          message.error(extractApiError(err));
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

  if (!detail) {
    return (
      <Alert
        type="error"
        showIcon
        message="Job not found"
        action={
          <Button onClick={() => navigate('/supplier/jobs')}>
            Back to jobs
          </Button>
        }
      />
    );
  }

  const { assignment, order, artwork, specs } = detail;

  return (
    <ShowPage
      title={`Job — ${order.orderId}`}
      backTo="/supplier/jobs"
      backLabel="Back to jobs"
      contentCard={false}
      extra={
        <Tag color="purple">Assignment #{assignment.id}</Tag>
      }
    >
      {canAccept && (
        <AcceptCountdownBanner deadline={assignment.acceptanceDeadline} />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Order" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Status">
                <StatusBadge status={order.orderStatus as OrderStatus} />
              </Descriptions.Item>
              <Descriptions.Item label="Decision">
                <Tag
                  color={
                    assignment.decision === 'accepted'
                      ? 'green'
                      : assignment.decision === 'pending'
                        ? 'blue'
                        : 'default'
                  }
                >
                  {assignment.decision}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag>{order.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Quantity">
                {order.quantity}
              </Descriptions.Item>
              <Descriptions.Item label="Guide total">
                {formatMinorAsCurrency(
                  order.finalTotalMinor ??
                    Math.round(Number(order.totalPrice) * 100),
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Committed price">
                {formatMinorAsCurrency(assignment.finalPriceMinor)}
              </Descriptions.Item>
              <Descriptions.Item label="Payment">
                {order.paymentMethod} · {order.paymentAuthorizationStatus}
              </Descriptions.Item>
              <Descriptions.Item label="Delivery">
                {order.deliveryOption}
              </Descriptions.Item>
              <Descriptions.Item label="Promised date">
                {assignment.promisedDate
                  ? formatDateTime(assignment.promisedDate)
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Accept deadline">
                {formatDateTime(assignment.acceptanceDeadline)}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card
            title={
              <Space>
                <FileSearchOutlined />
                Approved artwork
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
                ) : null}
                <Button
                  type="primary"
                  href={artwork.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open artwork
                </Button>
              </Space>
            ) : (
              <Alert
                type="warning"
                showIcon
                message="No artwork link"
                description={
                  artwork.fileName
                    ? `File "${artwork.fileName}" has no accessible storage link.`
                    : 'No file metadata on this order.'
                }
              />
            )}
          </Card>

          <Card title="Production specs" size="small" style={{ marginBottom: 16 }}>
            {specs.items.length === 0 ? (
              <Text type="secondary">No line items on this order.</Text>
            ) : (
              specs.items.map((item) => (
                <Card
                  key={item.id}
                  type="inner"
                  size="small"
                  title={
                    <Space>
                      <Text strong>
                        {item.categoryName || item.category}
                      </Text>
                      <Tag>qty {item.quantity}</Tag>
                    </Space>
                  }
                  style={{ marginBottom: 12 }}
                >
                  {item.specialInstructions && (
                    <Alert
                      type="info"
                      showIcon
                      message="Customer notes"
                      description={item.specialInstructions}
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  {item.specs.length === 0 ? (
                    <Text type="secondary">No specs recorded.</Text>
                  ) : (
                    <Descriptions column={1} size="small">
                      {item.specs.map((sv) => (
                        <Descriptions.Item key={sv.key} label={sv.label || sv.key}>
                          {sv.displayValue || sv.optionLabel || sv.value}
                        </Descriptions.Item>
                      ))}
                    </Descriptions>
                  )}
                </Card>
              ))
            )}
          </Card>

          <Card title="Pipeline" size="small">
            <Timeline
              items={pipeline.map((s) => ({
                color: s.color,
                children: (
                  <Text
                    strong={s.color === 'blue'}
                    type={s.color === 'gray' ? 'secondary' : undefined}
                  >
                    {s.label}
                  </Text>
                ),
              }))}
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          {(acceptWindowOpen || canDecline) && (
            <Card
              title="Accept or decline"
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {acceptWindowOpen && (
                  <>
                    <div>
                      <Title level={5} style={{ marginTop: 0 }}>
                        Final price (₱)
                      </Title>
                      <InputNumber
                        min={0.01}
                        step={1}
                        precision={2}
                        style={{ width: '100%' }}
                        value={pricePesos}
                        onChange={(v) => setPricePesos(v)}
                        addonBefore="₱"
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Sent as minor units (centavos) to the API.
                      </Text>
                    </div>
                    <div>
                      <Title level={5}>Promised ready date</Title>
                      <DatePicker
                        showTime
                        style={{ width: '100%' }}
                        value={promisedDate}
                        onChange={setPromisedDate}
                        disabledDate={(d) =>
                          d != null && d.isBefore(dayjs().startOf('day'))
                        }
                      />
                    </div>
                    <Button
                      type="primary"
                      block
                      size="large"
                      icon={<CheckCircleOutlined />}
                      loading={submitting}
                      disabled={acceptDeadlinePassed}
                      onClick={handleAccept}
                    >
                      Accept job
                    </Button>
                  </>
                )}
                {canAccept && acceptDeadlinePassed && (
                  <Alert
                    type="error"
                    showIcon
                    message="Accept disabled — deadline passed"
                    description="You can still decline, or wait for ops reassignment."
                  />
                )}

                {canDecline && (
                  <>
                    <div>
                      <Title level={5}>Decline reason</Title>
                      <TextArea
                        rows={3}
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        placeholder="e.g. At capacity this week"
                        maxLength={2000}
                        showCount
                      />
                    </div>
                    <Button
                      danger
                      block
                      icon={<CloseCircleOutlined />}
                      loading={submitting}
                      onClick={handleDecline}
                    >
                      Decline job
                    </Button>
                  </>
                )}
              </Space>
            </Card>
          )}

          {canProduction && (
            <Card
              title={
                <Space>
                  <ToolOutlined />
                  Production milestones
                </Space>
              }
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Radio.Group
                  value={milestone}
                  onChange={(e) => setMilestone(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {MILESTONES.map((m) => (
                      <Radio key={m.value} value={m.value}>
                        <span>
                          <Text strong>{m.label}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {m.description}
                          </Text>
                        </span>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
                <TextArea
                  rows={2}
                  value={prodNotes}
                  onChange={(e) => setProdNotes(e.target.value)}
                  placeholder="Optional notes"
                  maxLength={2000}
                />
                <Button
                  type="primary"
                  block
                  loading={submitting}
                  onClick={handleProduction}
                >
                  Update production status
                </Button>
              </Space>
            </Card>
          )}

          {canSelfQc && (
            <Card title="Self-QC evidence" size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Upload.Dragger
                  maxCount={1}
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  beforeUpload={() => false}
                  fileList={evidenceFile ? [evidenceFile] : []}
                  onChange={({ fileList }) => {
                    setEvidenceFile(fileList[0] ?? null);
                  }}
                  onRemove={() => {
                    setEvidenceFile(null);
                    return true;
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">
                    Drop photo or PDF evidence
                  </p>
                  <p className="ant-upload-hint">PNG, JPEG, WebP, or PDF · max 20 MB</p>
                </Upload.Dragger>
                <TextArea
                  rows={2}
                  value={selfQcNotes}
                  onChange={(e) => setSelfQcNotes(e.target.value)}
                  placeholder="Optional self-QC notes"
                  maxLength={2000}
                />
                <Button
                  type="primary"
                  block
                  loading={submitting}
                  onClick={handleSelfQc}
                >
                  Submit self-QC
                </Button>
              </Space>
            </Card>
          )}

          {canReady && (
            <Card title="Handoff" size="small" style={{ marginBottom: 16 }}>
              <Alert
                type="success"
                showIcon
                message="Self-QC complete"
                description="Mark the job ready so ops can assign a rider for pickup."
                style={{ marginBottom: 12 }}
              />
              <Button
                type="primary"
                block
                size="large"
                icon={<CheckCircleOutlined />}
                loading={submitting}
                onClick={handleReady}
              >
                Ready for pickup
              </Button>
            </Card>
          )}

          {!canAccept &&
            !canDecline &&
            !canProduction &&
            !canSelfQc &&
            !canReady && (
              <Card title="Actions" size="small">
                <Alert
                  type="info"
                  showIcon
                  message={
                    order.orderStatus === 'awaiting_payment'
                      ? 'Waiting for client payment authorization'
                      : order.orderStatus === 'ready_for_dispatch'
                        ? 'Job is ready for dispatch — no further supplier actions'
                        : `No actions available while status is ${statusLabel(order.orderStatus as OrderStatus)}`
                  }
                />
              </Card>
            )}
        </Col>
      </Row>
    </ShowPage>
  );
}
