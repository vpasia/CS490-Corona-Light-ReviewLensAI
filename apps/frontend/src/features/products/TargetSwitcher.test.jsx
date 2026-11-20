import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api.js';

import { listProducts } from './productsApi.js';
import TargetSwitcher from './TargetSwitcher.jsx';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

const products = [
  { productId: 'p1', productName: 'Echo Dot', platform: 'amazon' },
  { productId: 'p2', productName: 'Kindle', platform: 'amazon' },
];

function Page() {
  const { productId } = useParams();

  return (
    <>
      <p>{`Viewing ${productId}`}</p>
      <TargetSwitcher currentProductId={productId} />
    </>
  );
}

function renderAt(path = '/products/p1/overview') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/products/:productId/overview" element={<Page />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Lets the product list finish loading so "nothing is shown" checks are not trivially true.
async function settle() {
  await waitFor(() => expect(listProducts).toHaveBeenCalled());
  await act(async () => {});
}

describe('TargetSwitcher', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listProducts.mockResolvedValue(products);
  });

  it('lists the user’s products with the active one selected', async () => {
    renderAt('/products/p1/overview');

    const select = await screen.findByLabelText('Active product');

    expect(select).toHaveValue('p1');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Echo Dot',
      'Kindle',
    ]);
  });

  it('switches to the chosen product', async () => {
    const user = userEvent.setup();
    renderAt('/products/p1/overview');

    await user.selectOptions(await screen.findByLabelText('Active product'), 'p2');

    expect(await screen.findByText('Viewing p2')).toBeInTheDocument();
    expect(screen.queryByText('Viewing p1')).not.toBeInTheDocument();
  });

  it('shows nothing when the user has only one product', async () => {
    listProducts.mockResolvedValue([products[0]]);
    renderAt('/products/p1/overview');
    await settle();

    expect(screen.queryByLabelText('Active product')).not.toBeInTheDocument();
  });

  it('shows nothing while the product list is loading', () => {
    listProducts.mockReturnValue(new Promise(() => {}));
    renderAt('/products/p1/overview');

    expect(screen.queryByLabelText('Active product')).not.toBeInTheDocument();
  });

  it('shows nothing when the product list cannot be loaded', async () => {
    listProducts.mockRejectedValue(
      new ApiError({ status: 503, code: 'UNAVAILABLE', message: 'Unavailable.' }),
    );
    renderAt('/products/p1/overview');
    await settle();

    expect(screen.queryByLabelText('Active product')).not.toBeInTheDocument();
  });

  it('shows nothing when the current product is not in the user’s list', async () => {
    renderAt('/products/p9/overview');
    await settle();

    expect(screen.queryByLabelText('Active product')).not.toBeInTheDocument();
  });

  it('shows nothing when the list response is empty or missing', async () => {
    listProducts.mockResolvedValue(undefined);
    renderAt('/products/p1/overview');
    await settle();

    expect(screen.queryByLabelText('Active product')).not.toBeInTheDocument();
  });
});
