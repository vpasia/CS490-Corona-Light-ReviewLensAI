import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api.js';

import AddProductForm from './AddProductForm.jsx';
import { createProduct } from './productsApi.js';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

async function fillAndSubmit(user, name, link) {
  if (name) {
    await user.type(screen.getByLabelText('Product name'), name);
  }
  if (link) {
    await user.type(screen.getByLabelText('Amazon product link or ASIN'), link);
  }
  await user.click(screen.getByRole('button', { name: 'Add product' }));
}

describe('AddProductForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('says what is missing and does not call the backend when the form is empty', async () => {
    const user = userEvent.setup();
    render(<AddProductForm />);

    await fillAndSubmit(user, '', '');

    expect(screen.getByText('Enter a name for this product.')).toBeInTheDocument();
    expect(screen.getByText('Enter an Amazon product link or ASIN.')).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('rejects a link that is not an Amazon product link', async () => {
    const user = userEvent.setup();
    render(<AddProductForm />);

    await fillAndSubmit(user, 'Echo Dot', 'https://example.com/dp/B0ABCDEF12');

    expect(screen.getByText(/doesn’t look like an Amazon product link/)).toBeInTheDocument();
    expect(createProduct).not.toHaveBeenCalled();
  });

  it('sends the product name and Amazon link, then confirms and clears the form', async () => {
    createProduct.mockResolvedValue({ productId: 'product-1' });
    const user = userEvent.setup();
    render(<AddProductForm />);

    await fillAndSubmit(user, 'Echo Dot', 'https://www.amazon.com/dp/B0ABCDEF12');

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith({
        productName: 'Echo Dot',
        amazonUrl: 'https://www.amazon.com/dp/B0ABCDEF12',
      }),
    );
    expect(await screen.findByText('Added “Echo Dot”.')).toBeInTheDocument();
    expect(screen.getByLabelText('Product name')).toHaveValue('');
  });

  it('turns a bare ASIN into an Amazon link before sending', async () => {
    createProduct.mockResolvedValue({ productId: 'product-2' });
    const user = userEvent.setup();
    render(<AddProductForm />);

    await fillAndSubmit(user, 'Echo Dot', 'b0abcdef12');

    await waitFor(() =>
      expect(createProduct).toHaveBeenCalledWith({
        productName: 'Echo Dot',
        amazonUrl: 'https://www.amazon.com/dp/B0ABCDEF12',
      }),
    );
  });

  it('shows the backend’s field error under the matching field', async () => {
    createProduct.mockRejectedValue(
      new ApiError({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Required product information is missing.',
        details: [{ field: 'amazonUrl', message: 'That product link is not supported.' }],
      }),
    );
    const user = userEvent.setup();
    render(<AddProductForm />);

    await fillAndSubmit(user, 'Echo Dot', 'https://www.amazon.com/dp/B0ABCDEF12');

    expect(await screen.findByText('That product link is not supported.')).toBeInTheDocument();
  });

  it('shows a plain-language message and keeps what was typed when the server is unreachable', async () => {
    createProduct.mockRejectedValue(
      new ApiError({
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'We couldn’t reach the server. Check your connection and try again.',
      }),
    );
    const user = userEvent.setup();
    render(<AddProductForm />);

    await fillAndSubmit(user, 'Echo Dot', 'https://www.amazon.com/dp/B0ABCDEF12');

    expect(await screen.findByText(/couldn’t reach the server/)).toBeInTheDocument();
    expect(screen.getByLabelText('Product name')).toHaveValue('Echo Dot');
  });

  it('hides technical error text when something unexpected goes wrong', async () => {
    createProduct.mockRejectedValue(new Error('TypeError: x is undefined at line 42'));
    const user = userEvent.setup();
    render(<AddProductForm />);

    await fillAndSubmit(user, 'Echo Dot', 'https://www.amazon.com/dp/B0ABCDEF12');

    expect(await screen.findByText(/couldn’t add that product/)).toBeInTheDocument();
    expect(screen.queryByText(/TypeError/)).not.toBeInTheDocument();
  });
});
