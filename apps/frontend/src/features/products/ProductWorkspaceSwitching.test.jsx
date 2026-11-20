import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProductWorkspacePage from './ProductWorkspacePage.jsx';
import { getProduct, listIngestionRuns, listProducts, listReviews } from './productsApi.js';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

const productsById = {
  p1: {
    productId: 'p1',
    productName: 'First product',
    platform: 'amazon',
    amazonUrl: 'https://www.amazon.com/dp/B0AAAAAAA1',
  },
  p2: {
    productId: 'p2',
    productName: 'Second product',
    platform: 'amazon',
    amazonUrl: 'https://www.amazon.com/dp/B0BBBBBBB2',
  },
};
const succeededRun = {
  ingestionRunId: 'run-1',
  status: 'succeeded',
  reused: false,
  startedAt: { _seconds: 200, _nanoseconds: 0 },
  error: null,
};

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/products/p1/overview']}>
      <Routes>
        <Route path="/products/:productId/overview" element={<ProductWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductWorkspacePage product switching', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listProducts.mockResolvedValue(Object.values(productsById));
    getProduct.mockImplementation(async (id) => productsById[id]);
    listReviews.mockResolvedValue({ reviews: [], status: 'notImported', summary: null });
    listIngestionRuns.mockImplementation(async (id) => (id === 'p1' ? [succeededRun] : []));
  });

  it('shows the active product and lets the user switch to another one', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByRole('heading', { name: 'First product' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Active product')).toHaveValue('p1');

    await user.selectOptions(screen.getByLabelText('Active product'), 'p2');

    expect(await screen.findByRole('heading', { name: 'Second product' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'First product' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Active product')).toHaveValue('p2');
  });

  it('loads the new product’s own reviews and import status, not the previous one’s', async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(await screen.findByText('Import succeeded')).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText('Active product'), 'p2');

    expect(
      await screen.findByText('No import has been run for this product yet.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Import succeeded')).not.toBeInTheDocument();
    expect(listReviews).toHaveBeenCalledWith('p2');
    expect(listIngestionRuns).toHaveBeenCalledWith('p2');
  });
});
