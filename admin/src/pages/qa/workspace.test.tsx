// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QaWorkspacePage } from './workspace';

const { fetchQaWorkspace } = vi.hoisted(() => ({ fetchQaWorkspace: vi.fn() }));
vi.mock('@/services/qaApi', async () => {
  const actual = await vi.importActual<typeof import('@/services/qaApi')>('@/services/qaApi');
  return { ...actual, fetchQaWorkspace, submitQaDecision: vi.fn() };
});
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: '7' }),
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock('@/components/show-page', () => ({
  ShowPage: ({ title, children }: { title: string; children: ReactNode }) => <section><h1>{title}</h1>{children}</section>,
}));
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    App: { useApp: () => ({ message: { error: vi.fn(), warning: vi.fn(), success: vi.fn() }, modal: { confirm: vi.fn() } }) },
  };
});

describe('QaWorkspacePage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders all item snapshots and a visible authoritative coverage warning', async () => {
    fetchQaWorkspace.mockResolvedValue({
      order: {
        id: 7, orderId: 'ORD-RFQ-7', orderStatus: 'needs_qa', category: 'flyers', quantity: 112,
        totalPrice: null, deliveryFee: null, pricingStatus: 'pending_quote', quotedTotalMinor: null,
        unmetCoverage: true,
        matchingOutcome: { code: 'no_eligible_supplier', message: 'No verified supplier covers this batch' },
        items: [
          { id: 1, category: 'flyers', categoryName: 'Flyers', quantity: 100, totalPrice: null,
            specs: [{ key: 'finish', label: 'Finish', value: 'matte', displayValue: 'Matte' }] },
          { id: 2, category: 'custom-apparel', categoryName: 'Custom Apparel', quantity: 12, totalPrice: null,
            specs: [{ key: 'size', label: 'Size', value: 'xl', displayValue: 'XL' }] },
        ],
        paymentMethod: 'grid_credits', deliveryOption: 'delivery', fileName: 'batch.pdf', fileUrl: null,
        fileMetadataId: 1, adminNotes: null, declineReason: null,
        createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z',
        user: { id: 3, email: 'mark@example.test', fullName: 'Mark' },
      },
      artwork: { fileMetadataId: 1, fileName: 'batch.pdf', signedUrl: null },
      checklistKeys: [], reviews: [], allowedDecisions: [],
    });

    render(<QaWorkspacePage />);

    expect((await screen.findAllByText('Flyers')).length).toBeGreaterThan(0);
    expect(screen.getByText('Custom Apparel')).toBeInTheDocument();
    expect(screen.getByText('Matte')).toBeInTheDocument();
    expect(screen.getByText('XL')).toBeInTheDocument();
    expect(screen.getByText('No verified supplier covers this batch')).toBeInTheDocument();
    expect(screen.queryByText(/₱0\.00/)).not.toBeInTheDocument();
  });
});
