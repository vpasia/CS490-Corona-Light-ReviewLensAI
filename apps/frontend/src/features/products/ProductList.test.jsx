import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api.js';

import ProductList from './ProductList.jsx';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

const products = [
  {
    productId: 'p1',
    productName: 'Echo Dot',
    platform: 'amazon',
    amazonUrl: 'https://www.amazon.com/dp/B0ABCDEF12',
  },
  {
    productId: 'p2',
    productName: 'Kindle',
    platform: 'amazon',
    amazonUrl: 'https://www.amazon.com/dp/B0ZYXWVU98',
  },
];

function renderList(props) {
  return render(
    <MemoryRouter>
      <ProductList products={[]} error={null} onRetry={() => {}} {...props} />
    </MemoryRouter>,
  );
}

describe('ProductList', () => {
  it('shows loading placeholders while the list loads', () => {
    renderList({ status: 'loading' });

    expect(screen.getByRole('status', { name: 'Loading your products' })).toBeInTheDocument();
  });

  it('shows each product’s name, platform, and source link', () => {
    renderList({ status: 'ready', products });

    expect(screen.getByText('Echo Dot')).toBeInTheDocument();
    expect(screen.getByText('Kindle')).toBeInTheDocument();
    expect(screen.getAllByText('Amazon')).toHaveLength(2);
    expect(screen.getByText('https://www.amazon.com/dp/B0ABCDEF12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Echo Dot/ })).toHaveAttribute(
      'href',
      '/products/p1/overview',
    );
  });

  it('shows an empty message when the user has no products', () => {
    renderList({ status: 'ready', products: [] });

    expect(screen.getByText('No products yet')).toBeInTheDocument();
  });

  it('shows the server’s plain-language message and a Try again button on failure', async () => {
    const onRetry = vi.fn();
    const error = new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'We couldn’t reach the server. Check your connection and try again.',
    });
    const user = userEvent.setup();
    renderList({ status: 'error', error, onRetry });

    expect(screen.getByText(/couldn’t reach the server/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides technical error text when something unexpected fails', () => {
    renderList({ status: 'error', error: new Error('TypeError: x is undefined') });

    expect(screen.getByText(/couldn’t load your products/)).toBeInTheDocument();
    expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
  });
});
