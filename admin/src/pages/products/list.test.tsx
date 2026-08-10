// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductList } from './list';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('@/providers/api-client', () => ({ apiClient: { get: mockGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return { ...actual, App: { useApp: () => ({ message: { success: vi.fn(), error: vi.fn() } }) } };
});

const leaf = (group: number, index: number) => ({
  id: `${group}-${index}`, slug: `leaf-${group}-${index}`, name: `Leaf ${group}-${index}`,
  group_slug: `group-${group}`, group_name: `Group ${group}`,
  group_description: `Description ${group}`, group_sort_order: group,
  examples: ['Example'], description: 'Description', file_processing_type: 'generic_file',
  pricing_model: 'quote_required', base_rate: 0, quantity_unit: 'piece',
  max_file_size_mb: 100, allowed_extensions: ['pdf'], is_active: true,
  sort_order: index, created_at: '', updated_at: '',
});

describe('ProductList RFQ catalog', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('shows retry on load error and does not substitute mock catalog data', async () => {
    mockGet.mockRejectedValueOnce(new Error('catalog unavailable')).mockResolvedValueOnce({ data: [leaf(1, 1)] });
    render(<MemoryRouter><ProductList /></MemoryRouter>);
    expect(await screen.findByText('Unable to load catalog')).toBeInTheDocument();
    expect(screen.queryByText('Paper Printing')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText('Leaf 1-1')).toBeInTheDocument();
  });

  it('renders four sections and seventeen RFQ leaves without a zero base rate', async () => {
    const sizes = [5, 4, 4, 4];
    mockGet.mockResolvedValue({ data: sizes.flatMap((size, group) => Array.from({ length: size }, (_, i) => leaf(group + 1, i + 1))) });
    render(<MemoryRouter><ProductList /></MemoryRouter>);
    expect(await screen.findByText('Group 1')).toBeInTheDocument();
    expect(screen.getByText('Group 4')).toBeInTheDocument();
    expect(screen.getAllByText('Quote required')).toHaveLength(17);
    expect(screen.queryByText(/₱0\.00/)).not.toBeInTheDocument();
  });
});
