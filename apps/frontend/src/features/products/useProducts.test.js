import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listProducts } from './productsApi.js';
import { useProducts } from './useProducts.js';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

const echoDot = { productId: 'p1', productName: 'Echo Dot', platform: 'amazon' };

describe('useProducts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('starts loading, then returns the user’s products', async () => {
    listProducts.mockResolvedValue([echoDot]);

    const { result } = renderHook(() => useProducts());

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.products).toEqual([echoDot]);
  });

  it('reports a failure and recovers when retried', async () => {
    listProducts.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce([echoDot]);

    const { result } = renderHook(() => useProducts());

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.products).toEqual([]);

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.products).toEqual([echoDot]);
  });
});
