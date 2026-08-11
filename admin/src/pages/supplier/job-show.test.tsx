// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupplierJobShowPage } from './job-show';

const { fetchJob, acceptJob, confirm, success, error } = vi.hoisted(() => ({
  fetchJob: vi.fn(), acceptJob: vi.fn(), confirm: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: '5' }), useNavigate: () => vi.fn() }));
vi.mock('@/components/show-page', () => ({ ShowPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/services/supplierJobsApi', async () => {
  const actual = await vi.importActual<typeof import('@/services/supplierJobsApi')>('@/services/supplierJobsApi');
  return { ...actual, fetchSupplierJob: fetchJob, acceptSupplierJob: acceptJob, declineSupplierJob: vi.fn(), updateSupplierProductionStatus: vi.fn(), submitSupplierSelfQc: vi.fn(), markSupplierReadyForPickup: vi.fn() };
});
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  const dayjs = (await import('dayjs')).default;
  const app = { message: { success, error, warning: vi.fn() }, modal: { confirm } };
  return {
    ...actual,
    InputNumber: ({ value, onChange, addonBefore: _addonBefore, precision: _precision, ...props }: { value?: number | null; onChange?: (value: number | null) => void; addonBefore?: unknown; precision?: number; [key: string]: unknown }) => (
      <input {...props} type="number" value={value ?? ''} onChange={(event) => onChange?.(event.target.value ? Number(event.target.value) : null)} />
    ),
    DatePicker: ({ value, onChange, showTime: _showTime, disabledDate: _disabledDate, ...props }: { value?: { toISOString(): string } | null; onChange?: (value: ReturnType<typeof dayjs> | null) => void; showTime?: unknown; disabledDate?: unknown; [key: string]: unknown }) => (
      <input {...props} type="text" value={value?.toISOString() ?? ''} onChange={(event) => onChange?.(event.target.value ? dayjs(event.target.value) : null)} />
    ),
    App: { useApp: () => app },
  };
});

const detail = {
  assignment: { id: 5, orderId: 8, supplierId: 2, decision: 'pending', decisionReason: null, acceptanceDeadline: '2099-08-12T10:00:00.000Z', finalPriceMinor: null, promisedDate: null, rankPosition: 1, decidedAt: null, createdAt: '2026-08-10T00:00:00Z' },
  order: { id: 8, orderId: 'ORD-RFQ', orderStatus: 'supplier_assigned', category: 'custom-apparel', quantity: 25, pricingStatus: 'pending_quote', totalPrice: null, deliveryFee: null, finalTotalMinor: null, quotedTotalMinor: null, deliveryFeeMinor: null, paymentMethod: 'grid_credits', paymentAuthorizationStatus: 'none', deliveryOption: 'pickup', estimatedCompletionAt: null, createdAt: '', updatedAt: '' },
  artwork: { fileMetadataId: 4, fileName: 'shirt.pdf', signedUrl: 'https://example.test/artwork' },
  specs: { category: 'custom-apparel', quantity: 25, items: [{ id: 9, category: 'custom-apparel', categoryName: 'Custom Apparel', quantity: 25, specialInstructions: null, fileName: 'shirt.pdf', fileMetadataId: 4, specs: [{ key: 'placement', label: 'UV-DTF / CMYK+W', value: 'front', displayValue: 'Front chest', optionId: null, optionLabel: null }] }] },
  allowedActions: ['accept', 'decline', 'production-status'],
};

describe('SupplierJobShowPage RFQ', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('renders dynamic leaf/specs and keeps production payment-gated', async () => {
    fetchJob.mockResolvedValue(detail);
    render(<SupplierJobShowPage />);
    expect(await screen.findByText('Custom Apparel')).toBeInTheDocument();
    expect(screen.getByText('UV-DTF / CMYK+W')).toBeInTheDocument();
    expect(screen.getByText('Front chest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /accept job/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Final price (₱)')).toBeRequired();
    expect(screen.getByLabelText('Promised ready date')).toBeRequired();
    expect(screen.getByText('Price pending quote')).toBeInTheDocument();
    expect(screen.queryByText(/₱0\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText('Production milestones')).not.toBeInTheDocument();
  });

  it('submits the exact quote payload and preserves both fields after an API error', async () => {
    fetchJob.mockResolvedValue(detail);
    acceptJob.mockRejectedValue(new Error('Quote rejected'));
    render(<SupplierJobShowPage />);
    const amount = await screen.findByLabelText('Final price (₱)');
    const date = screen.getByLabelText('Promised ready date');
    fireEvent.change(amount, { target: { value: '123.45' } });
    fireEvent.change(date, { target: { value: '2099-08-15T10:30:00.000Z' } });
    fireEvent.click(screen.getByRole('button', { name: /accept job/i }));
    const options = confirm.mock.calls[confirm.mock.calls.length - 1]?.[0] as { onOk: () => Promise<void> };
    await expect(options.onOk()).rejects.toThrow('Quote rejected');
    expect(acceptJob).toHaveBeenCalledWith(5, {
      finalPriceMinor: 12345,
      promisedDate: '2099-08-15T10:30:00.000Z',
    });
    expect(amount).toHaveValue(123.45);
    expect(date).toHaveValue('2099-08-15T10:30:00.000Z');
    expect(error).toHaveBeenCalledWith('Quote rejected');
  });

  it('shows the server-confirmed quoted state and removes acceptance controls', async () => {
    fetchJob
      .mockResolvedValueOnce(detail)
      .mockResolvedValueOnce({
        ...detail,
        assignment: { ...detail.assignment, decision: 'accepted', finalPriceMinor: '12345', promisedDate: '2099-08-15T10:30:00.000Z' },
        order: { ...detail.order, pricingStatus: 'quoted', orderStatus: 'supplier_accepted', quotedTotalMinor: '12345' },
        allowedActions: [],
      });
    acceptJob.mockResolvedValue({
      assignment: {},
      order: { id: 8, orderId: 'ORD-RFQ', orderStatus: 'supplier_accepted', pricingStatus: 'quoted' },
      fromStatus: 'supplier_assigned', toStatus: 'supplier_accepted',
    });
    render(<SupplierJobShowPage />);
    fireEvent.change(await screen.findByLabelText('Final price (₱)'), { target: { value: '123.45' } });
    fireEvent.change(screen.getByLabelText('Promised ready date'), { target: { value: '2099-08-15T10:30:00.000Z' } });
    fireEvent.click(screen.getByRole('button', { name: /accept job/i }));
    const options = confirm.mock.calls[confirm.mock.calls.length - 1]?.[0] as { onOk: () => Promise<void> };
    await options.onOk();
    expect(success).toHaveBeenCalledWith('Quote submitted · pricing status quoted');
    await waitFor(() => expect(screen.queryByRole('button', { name: /accept job/i })).not.toBeInTheDocument());
  });

  it('exposes an accessible load error and retry action', async () => {
    fetchJob.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(detail);
    render(<SupplierJobShowPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Network unavailable');
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Custom Apparel')).toBeInTheDocument();
  });
});
