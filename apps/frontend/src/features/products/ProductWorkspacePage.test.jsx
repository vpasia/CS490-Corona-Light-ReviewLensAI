import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api.js';

import ProductWorkspacePage from './ProductWorkspacePage.jsx';
import { getProduct, importReviews, listReviews } from './productsApi.js';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

const product = {
  productId: 'p1',
  productName: 'Echo Dot',
  platform: 'amazon',
  amazonUrl: 'https://www.amazon.com/dp/B0ABCDEF12',
};
const savedReview = { reviewId: 'r1', text: 'Sound is crisp', rating: 4 };

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
    listReviews.mockResolvedValue([]);
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
    importReviews.mockResolvedValue({ savedCount: 12 });
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

  it('says cached reviews were reused instead of claiming a new import', async () => {
    getProduct.mockResolvedValue(product);
    importReviews.mockResolvedValue({ reused: true, savedCount: 0, reviewCount: 30 });
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('button', { name: 'Import reviews' }));

    expect(await screen.findByText('Using 30 cached reviews.')).toBeInTheDocument();
    expect(screen.queryByText(/just now/)).not.toBeInTheDocument();
  });

  it('still shows a plain message when the cached review count is missing', async () => {
    getProduct.mockResolvedValue(product);
    importReviews.mockResolvedValue({ reused: true, savedCount: 0 });
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(await screen.findByRole('button', { name: 'Import reviews' }));

    expect(await screen.findByText('Using cached reviews.')).toBeInTheDocument();
  });

  it('shows reviews saved earlier without importing again', async () => {
    getProduct.mockResolvedValue(product);
    listReviews.mockResolvedValue([savedReview]);
    renderWorkspace();

    expect(await screen.findByText('Sound is crisp')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rated 4 out of 5' })).toBeInTheDocument();
    expect(listReviews).toHaveBeenCalledWith('p1');
    expect(importReviews).not.toHaveBeenCalled();
  });

  it('refreshes the saved reviews after a successful import', async () => {
    getProduct.mockResolvedValue(product);
    listReviews.mockResolvedValueOnce([]).mockResolvedValueOnce([savedReview]);
    importReviews.mockResolvedValue({ savedCount: 1 });
    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByText('No reviews imported')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import reviews' }));

    expect(await screen.findByText('Sound is crisp')).toBeInTheDocument();
    expect(listReviews).toHaveBeenCalledTimes(2);
  });

  it('keeps the saved reviews when an import fails', async () => {
    getProduct.mockResolvedValue(product);
    listReviews.mockResolvedValue([savedReview]);
    importReviews.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'INGESTION_IN_PROGRESS',
        message: 'An import is already running for this product.',
      }),
    );
    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByText('Sound is crisp')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Import reviews' }));

    expect(
      await screen.findByText('An import is already running for this product.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Sound is crisp')).toBeInTheDocument();
    expect(listReviews).toHaveBeenCalledTimes(1);
  });

  it('only loads reviews for the product being viewed', async () => {
    getProduct.mockResolvedValue(product);
    listReviews.mockResolvedValue([savedReview]);
    renderWorkspace();

    await screen.findByText('Sound is crisp');
    expect(listReviews.mock.calls).toEqual([['p1']]);
  });
});
