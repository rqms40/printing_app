// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProductOptionsPage } from './options';

const { mockGet, mockPost, mockPatch, mockDelete, confirm } = vi.hoisted(() => ({
  mockGet: vi.fn(), mockPost: vi.fn(), mockPatch: vi.fn(), mockDelete: vi.fn(), confirm: vi.fn(),
}));
vi.mock('@/providers/api-client', () => ({ apiClient: { get: mockGet, post: mockPost, patch: mockPatch, delete: mockDelete } }));
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  const app = { message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() }, modal: { confirm } };
  return {
    ...actual,
    App: { useApp: () => app },
    Tabs: ({ items }: { items: Array<{ key: string; label: React.ReactNode; children: React.ReactNode }> }) => (
      <div>{items.map((item) => <section key={item.key}>{item.label}{item.children}</section>)}</div>
    ),
    Table: ({ dataSource, columns }: { dataSource: Array<Record<string, unknown>>; columns: Array<{ title?: React.ReactNode; dataIndex?: string; render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode }> }) => (
      <table><tbody>{dataSource.map((row) => <tr key={String(row.id)}>{columns.map((column, index) => <td key={index}>{column.render ? column.render(column.dataIndex ? row[column.dataIndex] : undefined, row) : String(column.dataIndex ? row[column.dataIndex] ?? '' : '')}</td>)}</tr>)}</tbody></table>
    ),
    Modal: ({ open, children, onOk, okText }: { open?: boolean; children?: React.ReactNode; onOk?: () => void; okText?: string }) => open ? <div role="dialog">{children}<button onClick={onOk}>{okText}</button></div> : null,
  };
});

const fixture = (url: string) => Promise.resolve({ data:
  url.includes('spec-definitions') ? [{ id: 2, categoryId: 1, key: 'finish', label: 'Finish', inputType: 'select', valueType: 'string', isRequired: true, isActive: true, pricingRole: 'none', sortOrder: 1 }] :
  url.includes('/options?') ? [
    { id: 3, categoryId: 1, specDefinitionId: 2, optionGroup: 'finish', label: 'Matte', value: 'matte', multiplier: 1, fixedFee: 0, unitCost: 0, isDefault: true, isActive: true, sortOrder: 1 },
    { id: 4, categoryId: 1, specDefinitionId: 2, optionGroup: 'finish', label: 'Gloss', value: 'gloss', multiplier: 1, fixedFee: 0, unitCost: 0, isDefault: false, isActive: true, sortOrder: 2 },
  ] :
  { id: 1, name: 'Flyers', slug: 'flyers', pricingModel: 'quote_required', baseRate: 0, quantityUnit: 'copy', maxFileSizeMb: 100, allowedExtensions: ['pdf'], isActive: true, sortOrder: 1 }
});

function renderPage() {
  return render(<MemoryRouter initialEntries={['/products/1/options']}><Routes><Route path="/products/:id/options" element={<ProductOptionsPage />} /></Routes></MemoryRouter>);
}

describe('ProductOptionsPage', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });
  it('keeps specification and option CRUD controls available for RFQ leaves', async () => {
    mockGet.mockImplementation(fixture);
    renderPage();
    expect(await screen.findByText('Product Specs — Flyers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /new spec/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add finish option/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText('Matte')).toBeInTheDocument();
  });

  it('creates, edits, activates, reorders, and deletes options through the supported API', async () => {
    mockGet.mockImplementation(fixture);
    mockPost.mockResolvedValue({ data: {} });
    mockPatch.mockResolvedValue({ data: {} });
    mockDelete.mockResolvedValue({ data: {} });
    renderPage();
    await screen.findByText('Matte');

    fireEvent.click(screen.getByRole('button', { name: /add finish option/i }));
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Soft touch' } });
    fireEvent.change(screen.getByLabelText('Value (slug)'), { target: { value: 'soft_touch' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/products/spec-options', expect.objectContaining({
      label: 'Soft touch', value: 'soft_touch', specDefinitionId: 2,
    })));

    const multiplier = screen.getByRole('spinbutton', { name: 'Multiplier for Matte' });
    fireEvent.change(multiplier, { target: { value: '1.25' } });
    fireEvent.blur(multiplier);
    expect(mockPatch).toHaveBeenCalledWith('/products/spec-options/3', { multiplier: 1.25 });

    fireEvent.click(screen.getByRole('switch', { name: 'Visible option Matte' }));
    expect(mockPatch).toHaveBeenCalledWith('/products/spec-options/3', { isActive: false });

    fireEvent.click(screen.getByRole('button', { name: 'Move Matte down' }));
    expect(mockPatch).toHaveBeenCalledWith('/products/options/reorder', {
      items: [{ id: 4, sortOrder: 0 }, { id: 3, sortOrder: 1 }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete option Matte' }));
    const options = confirm.mock.calls[confirm.mock.calls.length - 1]?.[0] as { onOk: () => Promise<void> };
    await options.onOk();
    expect(mockDelete).toHaveBeenCalledWith('/products/options/3');
  });
});
