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

  it('uses the bounded QA projection directly with one request', async () => {
    mockGet.mockResolvedValue({ data: [{
      id: 7, category: 'flyers', quantity: 10, totalPrice: null,
      pricingStatus: 'pending_quote', quotedTotalMinor: null,
      unmetCoverage: true,
      matchingOutcome: { code: 'no_eligible_supplier', message: 'No coverage' },
      items: [{ id: 8, category: 'flyers', categoryName: 'Flyers', quantity: 10, totalPrice: null }],
    }] });
    const rows = await fetchQaQueue();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/ops/qa/queue');
    expect(rows[0]).toMatchObject({ category: 'flyers', pricingStatus: 'pending_quote', items: [{ categoryName: 'Flyers' }] });
  });

  it('loads the complete QA workspace with one request', async () => {
    mockGet.mockResolvedValue({ data: {
      order: { id: 7, category: 'custom-apparel', quantity: 2, totalPrice: 123.45,
        pricingStatus: 'quoted', quotedTotalMinor: '12345',
        items: [{ id: 8, category: 'custom-apparel', categoryName: 'Custom Apparel', quantity: 2, totalPrice: 123.45 }] },
      artwork: {}, checklistKeys: [], reviews: [], allowedDecisions: [],
    } });
    const workspace = await fetchQaWorkspace(7);
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/ops/qa/7');
    expect(workspace.order).toMatchObject({ category: 'custom-apparel', pricingStatus: 'quoted', quotedTotalMinor: '12345' });
  });
});
