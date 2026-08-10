// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductOptionsPage } from './options';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('@/providers/api-client', () => ({ apiClient: { get: mockGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, App: { useApp: () => ({ message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, modal: { confirm: vi.fn() } }) } };
});

describe('ProductOptionsPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('keeps specification and option CRUD controls available for RFQ leaves', async () => {
    mockGet.mockImplementation((url: string) => Promise.resolve({ data:
      url.includes('spec-definitions') ? [{ id: 2, categoryId: 1, key: 'finish', label: 'Finish', inputType: 'select', valueType: 'string', isRequired: true, isActive: true, pricingRole: 'none', sortOrder: 1 }] :
      url.includes('/options?') ? [{ id: 3, categoryId: 1, specDefinitionId: 2, optionGroup: 'finish', label: 'Matte', value: 'matte', multiplier: 1, fixedFee: 0, unitCost: 0, isDefault: true, isActive: true, sortOrder: 1 }] :
      { id: 1, name: 'Flyers', slug: 'flyers', pricingModel: 'quote_required', baseRate: 0, quantityUnit: 'copy', maxFileSizeMb: 100, allowedExtensions: ['pdf'], isActive: true, sortOrder: 1 }
    }));
    render(<MemoryRouter initialEntries={['/products/1/options']}><Routes><Route path="/products/:id/options" element={<ProductOptionsPage />} /></Routes></MemoryRouter>);
    expect(await screen.findByText('Product Specs — Flyers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new spec/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add finish option/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText('Matte')).toBeInTheDocument();
  });
});
