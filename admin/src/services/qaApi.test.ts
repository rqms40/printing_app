import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchQaQueue, fetchQaWorkspace, qaOrderItems } from './qaApi';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('@/providers/api-client', () => ({ apiClient: { get: mockGet } }));

describe('QA order rendering adapter', () => {
  beforeEach(() => mockGet.mockReset());
  it('preserves projected dynamic leaves/specs and falls back without coercing unknown categories', () => {
    expect(qaOrderItems({
      id: 1, category: 'future-leaf', quantity: 2, totalPrice: null,
      items: [{ id: 2, category: 'future-leaf', categoryName: 'Future Leaf', quantity: 2, totalPrice: null,
        specs: [{ key: 'finish', label: 'Finish', value: 'matte', displayValue: 'Matte' }] }],
    })).toMatchObject([{ category: 'future-leaf', category_name: 'Future Leaf', specs: [{ display_value: 'Matte' }] }]);
    expect(qaOrderItems({ id: 1, category: 'unknown-leaf', quantity: 1, totalPrice: null })[0].category).toBe('unknown-leaf');
  });

  it('joins QA rows to the bounded Admin projection without per-row calls', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve({ data:
      url === '/ops/qa/queue'
        ? [{ id: 7, category: 'paper', quantity: 1, totalPrice: 0 }]
        : [{ id: 7, category: 'flyers', pricing_status: 'pending_quote', quoted_total_minor: null, items: [{ id: 8, category: 'flyers', category_name: 'Flyers', quantity: 10, total_price: null }] }],
    }));
    const rows = await fetchQaQueue();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(rows[0]).toMatchObject({ category: 'flyers', pricingStatus: 'pending_quote', items: [{ categoryName: 'Flyers' }] });
  });

  it('loads the QA workspace and one Admin detail projection in parallel', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve({ data:
      url === '/ops/qa/7'
        ? { order: { id: 7, category: 'paper', quantity: 1, totalPrice: 0 }, artwork: {}, checklistKeys: [], reviews: [], allowedDecisions: [] }
        : { id: 7, category: 'custom-apparel', pricing_status: 'quoted', quoted_total_minor: '12345', items: [{ id: 8, category: 'custom-apparel', category_name: 'Custom Apparel', quantity: 2, total_price: 123.45 }] },
    }));
    const workspace = await fetchQaWorkspace(7);
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(workspace.order).toMatchObject({ category: 'custom-apparel', pricingStatus: 'quoted', quotedTotalMinor: '12345' });
  });
});
