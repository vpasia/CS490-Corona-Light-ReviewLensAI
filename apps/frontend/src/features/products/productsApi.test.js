import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '../../lib/api.js';

import { askQuestion, listReviews } from './productsApi.js';

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
    apiRequest.mockResolvedValue({
      data: [{ reviewId: 'r1', text: 'Great', rating: 5 }],
      status: 'ready',
      summary: { reviewCount: 1, averageRating: 5 },
    });

    await expect(listReviews('p 1')).resolves.toEqual({
      reviews: [{ reviewId: 'r1', text: 'Great', rating: 5 }],
      status: 'ready',
      summary: { reviewCount: 1, averageRating: 5 },
    });
    expect(apiRequest).toHaveBeenCalledWith('/api/products/p%201/reviews');
  });

  it('returns an empty list when the response has no data', async () => {
    apiRequest.mockResolvedValue({});

    await expect(listReviews('p1')).resolves.toEqual({
      reviews: [],
      status: 'notImported',
      summary: null,
    });
  });
});

describe('askQuestion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('posts the question to the product’s analyze endpoint', async () => {
    apiRequest.mockResolvedValue({ data: { answer: 'Battery life is praised.' } });

    await expect(askQuestion('p 1', 'How is the battery?')).resolves.toEqual({
      answer: 'Battery life is praised.',
    });
    expect(apiRequest).toHaveBeenCalledWith('/api/products/p%201/analyze', {
      method: 'POST',
      body: { question: 'How is the battery?' },
    });
  });

  it('returns null when the response has no data', async () => {
    apiRequest.mockResolvedValue({});

    await expect(askQuestion('p1', 'Anything?')).resolves.toBeNull();
  });
});
