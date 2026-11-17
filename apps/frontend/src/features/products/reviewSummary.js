export const STAR_VALUES = [5, 4, 3, 2, 1];

// Half-star ratings (like 4.5) are counted in the nearest whole-star bucket,
// matching how StarRating rounds them.
export function summarizeReviews(reviews) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let count = 0;
  let total = 0;

  for (const review of reviews) {
    const rating = review?.rating;
    if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      continue;
    }
    distribution[Math.round(rating)] += 1;
    count += 1;
    total += rating;
  }

  return { count, average: count === 0 ? null : total / count, distribution };
}
