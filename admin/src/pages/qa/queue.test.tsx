// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QaQueuePage } from './queue';

const { fetchQaQueue } = vi.hoisted(() => ({ fetchQaQueue: vi.fn() }));
vi.mock('@/services/qaApi', async () => {
  const actual = await vi.importActual<typeof import('@/services/qaApi')>('@/services/qaApi');
  return { ...actual, fetchQaQueue };
});
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    App: { useApp: () => ({ message: { error: vi.fn() } }) },
  };
});

describe('QaQueuePage', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders every batch leaf and the authoritative unmet-coverage warning', async () => {
    fetchQaQueue.mockResolvedValue([{
      id: 7,
      orderId: 'ORD-RFQ-7',
      orderStatus: 'needs_qa',
      category: 'flyers',
      quantity: 112,
      totalPrice: null,
      pricingStatus: 'pending_quote',
      quotedTotalMinor: null,
      unmetCoverage: true,
      matchingOutcome: {
        code: 'no_eligible_supplier',
        message: 'No verified supplier covers all requested products',
      },
      items: [
        { id: 1, category: 'flyers', categoryName: 'Flyers', quantity: 100, totalPrice: null, specs: [] },
        { id: 2, category: 'custom-apparel', categoryName: 'Custom Apparel', quantity: 12, totalPrice: null, specs: [] },
      ],
      fileName: 'batch.pdf', fileMetadataId: 1, userId: 3,
      userEmail: 'mark@example.test', userFullName: 'Mark',
      createdAt: '2026-08-10T00:00:00.000Z', updatedAt: '2026-08-10T00:00:00.000Z',
      latestReview: null,
    }]);

    render(<QaQueuePage />);

    expect(await screen.findByText('Flyers')).toBeInTheDocument();
    expect(screen.getByText('Custom Apparel')).toBeInTheDocument();
    expect(screen.getByText('No verified supplier covers all requested products')).toBeInTheDocument();
    expect(screen.queryByText(/₱0\.00/)).not.toBeInTheDocument();
  });
});
