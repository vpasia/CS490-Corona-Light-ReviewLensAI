import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api.js';

import { listReviews } from './productsApi.js';
import { useReviews } from './useReviews.js';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

const review = { reviewId: 'r1', text: 'Sound is crisp', rating: 4 };

describe('useReviews', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads saved reviews', async () => {
    listReviews.mockResolvedValue({
      reviews: [review],
      status: 'ready',
      summary: { reviewCount: 1, averageRating: 4 },
    });

    const { result } = renderHook(() => useReviews('p1'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.reviews).toEqual([review]);
    expect(result.current.summary).toEqual({ reviewCount: 1, averageRating: 4 });
    expect(listReviews).toHaveBeenCalledWith('p1');
  });

  it('treats a missing list as no reviews', async () => {
    listReviews.mockResolvedValue({ reviews: [], status: 'notImported', summary: null });

    const { result } = renderHook(() => useReviews('p1'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.reviews).toEqual([]);
    expect(result.current.datasetStatus).toBe('notImported');
  });

  it('shows the server’s message and recovers on reload', async () => {
    listReviews
      .mockRejectedValueOnce(
        new ApiError({
          status: 503,
          code: 'REVIEW_CACHE_INCOMPLETE',
          message: 'Review data needs to be refreshed.',
        }),
      )
      .mockResolvedValueOnce({
        reviews: [review],
        status: 'ready',
        summary: { reviewCount: 1, averageRating: 4 },
      });

    const { result } = renderHook(() => useReviews('p1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('Review data needs to be refreshed.');
    expect(result.current.reviews).toEqual([]);
    expect(result.current.summary).toBeNull();

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.reviews).toEqual([review]);
    expect(result.current.errorMessage).toBe('');
  });

  it('carries an expired dataset without a numeric summary', async () => {
    listReviews.mockResolvedValue({ reviews: [], status: 'expired', summary: null });
    const { result } = renderHook(() => useReviews('p1'));
    await waitFor(() => expect(result.current.datasetStatus).toBe('expired'));
    expect(result.current.reviews).toEqual([]);
    expect(result.current.summary).toBeNull();
  });

  it('hides unexpected error details', async () => {
    listReviews.mockRejectedValue(new Error('TypeError: boom'));

    const { result } = renderHook(() => useReviews('p1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe(
      'We couldn’t load saved reviews right now. Please try again.',
    );
  });
});
