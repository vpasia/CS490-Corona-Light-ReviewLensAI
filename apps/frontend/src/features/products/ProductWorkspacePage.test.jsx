import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api.js';

import ProductWorkspacePage from './ProductWorkspacePage.jsx';
import { getProduct, importReviews } from './productsApi.js';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

const product = {
  productId: 'p1',
  productName: 'Echo Dot',
  platform: 'amazon',
  amazonUrl: 'https://www.amazon.com/dp/B0ABCDEF12',
};

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/products/p1/overview']}>
      <Routes>
        <Route path="/" element={<p>Home screen</p>} />
        <Route path="/products/:productId/overview" element={<ProductWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductWorkspacePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading placeholders while the product loads', () => {
    getProduct.mockReturnValue(new Promise(() => {}));
    renderWorkspace();

    expect(screen.getByRole('status', { name: 'Loading product' })).toBeInTheDocument();
  });

  it('shows the active product’s name, platform, and source link', async () => {
    getProduct.mockResolvedValue(product);
    renderWorkspace();

    expect(await screen.findByRole('heading', { name: 'Echo Dot' })).toBeInTheDocument();
    expect(getProduct).toHaveBeenCalledWith('p1');
    expect(screen.getByText('Platform: Amazon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: product.amazonUrl })).toHaveAttribute(
      'href',
      product.amazonUrl,
    );
    expect(screen.getByText('Ready to import reviews from Amazon.')).toBeInTheDocument();
  });

  it('shows a not-found screen when the product is missing or belongs to someone else', async () => {
    getProduct.mockRejectedValue(
      new ApiError({ status: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found.' }),
    );
    renderWorkspace();

    expect(await screen.findByText('Product not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to your products' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Echo Dot' })).not.toBeInTheDocument();
  });

  it('offers Try again when the product cannot be loaded, then shows it', async () => {
    getProduct
      .mockRejectedValueOnce(
        new ApiError({
          status: 0,
          code: 'NETWORK_ERROR',
          message: 'We couldn’t reach the server. Check your connection and try again.',
        }),
      )
      .mockResolvedValueOnce(product);
    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByText(/couldn’t reach the server/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Echo Dot' })).toBeInTheDocument();
  });

  it('hides technical error text when something unexpected fails', async () => {
    getProduct.mockRejectedValue(new Error('TypeError: x is undefined at line 42'));
    renderWorkspace();

    expect(await screen.findByText(/couldn’t load this product/)).toBeInTheDocument();
    expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
  });

  it('does not turn a non-web source into a clickable link', async () => {
    getProduct.mockResolvedValue({ ...product, amazonUrl: 'javascript:alert(1)' });
    renderWorkspace();

    expect(await screen.findByText(/javascript:alert\(1\)/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /javascript/ })).not.toBeInTheDocument();
  });

  it('shows progress and disables the button while reviews import', async () => {
    getProduct.mockResolvedValue(product);
    importReviews.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('button', { name: 'Import reviews' }));

    expect(screen.getByText('Importing reviews from Amazon…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import reviews' })).toBeDisabled();
  });

  it('confirms how many reviews were imported', async () => {
    getProduct.mockResolvedValue(product);
    importReviews.mockResolvedValue({ importedCount: 12 });
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('button', { name: 'Import reviews' }));

    expect(await screen.findByText('Imported 12 reviews just now.')).toBeInTheDocument();
    expect(importReviews).toHaveBeenCalledWith('p1');
  });

  it('shows the import error and a Try again button when the import fails', async () => {
    getProduct.mockResolvedValue(product);
    importReviews.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'INGESTION_IN_PROGRESS',
        message: 'An import is already running for this product.',
      }),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('button', { name: 'Import reviews' }));

    expect(
      await screen.findByText('An import is already running for this product.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
