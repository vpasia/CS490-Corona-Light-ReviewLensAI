import { describe, expect, it } from 'vitest';

import { summarizeReviews } from './reviewSummary.js';

const fixture = [
  { reviewId: 'r1', text: 'a', rating: 5 },
  { reviewId: 'r2', text: 'b', rating: 5 },
  { reviewId: 'r3', text: 'c', rating: 4 },
  { reviewId: 'r4', text: 'd', rating: 3 },
  { reviewId: 'r5', text: 'e', rating: 1 },
];

describe('summarizeReviews', () => {
  it('counts the reviews and calculates the exact average and star counts', () => {
    expect(summarizeReviews(fixture)).toEqual({
      count: 5,
      average: 3.6,
      distribution: { 1: 1, 2: 0, 3: 1, 4: 1, 5: 2 },
    });
  });

  it('returns zero reviews and no average for an empty list', () => {
    expect(summarizeReviews([])).toEqual({
      count: 0,
      average: null,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it('ignores records without a usable rating instead of counting them', () => {
    const result = summarizeReviews([
      { rating: 4 },
      { rating: '5' },
      { rating: 9 },
      { rating: 0 },
      { text: 'no rating' },
      null,
    ]);

    expect(result.count).toBe(1);
    expect(result.average).toBe(4);
  });

  it('puts half-star ratings in the nearest star bucket but averages the real value', () => {
    const result = summarizeReviews([{ rating: 4.5 }, { rating: 3 }]);

    expect(result.distribution[5]).toBe(1);
    expect(result.distribution[3]).toBe(1);
    expect(result.average).toBe(3.75);
  });
});
