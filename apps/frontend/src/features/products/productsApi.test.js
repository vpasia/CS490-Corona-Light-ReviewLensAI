import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '../../lib/api.js';

import { listReviews } from './productsApi.js';

vi.mock('../../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}));
vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

describe('listReviews', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('requests the product’s saved reviews', async () => {
    apiRequest.mockResolvedValue({ data: [{ reviewId: 'r1', text: 'Great', rating: 5 }] });

    await expect(listReviews('p 1')).resolves.toEqual([
      { reviewId: 'r1', text: 'Great', rating: 5 },
    ]);
    expect(apiRequest).toHaveBeenCalledWith('/api/products/p%201/reviews');
  });

  it('returns an empty list when the response has no data', async () => {
    apiRequest.mockResolvedValue({});

    await expect(listReviews('p1')).resolves.toEqual([]);
  });
});
