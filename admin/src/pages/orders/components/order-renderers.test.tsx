// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { OrderPrice } from './order-price';
import { OrderProductLabel } from './order-product-label';
import { OrderSpecifications } from './order-specifications';

describe('RFQ order renderers', () => {
  it('renders a dynamic leaf and API-owned spec snapshot', () => {
    const item = {
      id: '1', category: 'future-leaf', category_slug: 'future-leaf',
      category_name: 'Future Product', group_name: 'Future Group', quantity: 2,
      total_price: null,
      specs: [{ key: 'ink', label: 'UV-DTF / CMYK+W', value: 'raw', display_value: 'White underbase' }],
    };
    render(<><OrderProductLabel item={item} /><OrderSpecifications item={item} /></>);
    expect(screen.getByText('Future Product')).toBeInTheDocument();
    expect(screen.getByText('Future Group')).toBeInTheDocument();
    expect(screen.getByText('UV-DTF / CMYK+W')).toBeInTheDocument();
    expect(screen.getByText('White underbase')).toBeInTheDocument();
    expect(screen.queryByText('Paper')).not.toBeInTheDocument();
    expect(screen.queryByText('3D')).not.toBeInTheDocument();
  });

  it('never formats pending quote or absent item money as zero', () => {
    const { rerender } = render(<OrderPrice pricingStatus="pending_quote" minor={null} />);
    expect(screen.getByText('Price pending quote')).toBeInTheDocument();
    expect(screen.queryByText(/₱0/)).not.toBeInTheDocument();
    rerender(<OrderPrice pricingStatus="quoted" minor="900719925474099312345" />);
    expect(screen.getByText('₱9,007,199,254,740,993,123.45')).toBeInTheDocument();
    rerender(<OrderPrice pricingStatus="accepted" minor="12345" />);
    expect(screen.getByText('₱123.45')).toBeInTheDocument();
  });

  it('renders exact legacy labels only for exact legacy slugs', () => {
    const item = { id: '1', category: 'paper', quantity: 1, total_price: 20 } as const;
    const { rerender } = render(<OrderProductLabel item={item} />);
    expect(screen.getByText('Paper')).toBeInTheDocument();
    rerender(<OrderProductLabel item={{ ...item, category: 'paper-plus' }} />);
    expect(screen.getByText('paper-plus')).toBeInTheDocument();
  });
});
