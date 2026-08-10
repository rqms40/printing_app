// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupplierJobShowPage } from './job-show';

const { fetchJob } = vi.hoisted(() => ({ fetchJob: vi.fn() }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: '5' }), useNavigate: () => vi.fn() }));
vi.mock('@/components/show-page', () => ({ ShowPage: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/services/supplierJobsApi', async () => {
  const actual = await vi.importActual<typeof import('@/services/supplierJobsApi')>('@/services/supplierJobsApi');
  return { ...actual, fetchSupplierJob: fetchJob, acceptSupplierJob: vi.fn(), declineSupplierJob: vi.fn(), updateSupplierProductionStatus: vi.fn(), submitSupplierSelfQc: vi.fn(), markSupplierReadyForPickup: vi.fn() };
});
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, App: { useApp: () => ({ message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, modal: { confirm: vi.fn() } }) } };
});

const detail = {
  assignment: { id: 5, orderId: 8, supplierId: 2, decision: 'pending', decisionReason: null, acceptanceDeadline: '2099-08-12T10:00:00.000Z', finalPriceMinor: null, promisedDate: null, rankPosition: 1, decidedAt: null, createdAt: '2026-08-10T00:00:00Z' },
  order: { id: 8, orderId: 'ORD-RFQ', orderStatus: 'supplier_assigned', category: 'custom-apparel', quantity: 25, totalPrice: 0, deliveryFee: 0, finalTotalMinor: null, deliveryFeeMinor: null, paymentMethod: 'pending_quote', paymentAuthorizationStatus: 'none', deliveryOption: 'pickup', estimatedCompletionAt: null, createdAt: '', updatedAt: '' },
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
    expect(screen.queryByText('Production milestones')).not.toBeInTheDocument();
  });
});
