import { STAR_VALUES, summarizeReviews } from './reviewSummary.js';

export default function ReviewSummaryCard({ reviews, summary }) {
  const { distribution } = summarizeReviews(reviews);
  const count = summary?.reviewCount ?? 0;
  const average = summary?.averageRating;

  if (count === 0 || average == null) {
    return null;
  }

  return (
    <section
      aria-labelledby="review-summary-heading"
      className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] p-6"
    >
      <h2 id="review-summary-heading" className="text-lg font-semibold text-[#1F1F1F]">
        Review summary
      </h2>

      <dl className="flex gap-8">
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-[#6B6B6B]">Total reviews</dt>
          <dd className="text-2xl font-semibold text-[#1F1F1F]">{count}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-[#6B6B6B]">Average rating</dt>
          <dd className="text-2xl font-semibold text-[#1F1F1F]">{average.toFixed(1)} out of 5</dd>
        </div>
      </dl>

      <ul aria-label="Ratings breakdown" className="flex flex-col gap-2">
        {STAR_VALUES.map((star) => {
          const starCount = distribution[star];
          const percent = Math.round((starCount / count) * 100);
          return (
            <li key={star} className="flex items-center gap-3 text-sm">
              <span className="w-14 text-[#6B6B6B]">
                {star} {star === 1 ? 'star' : 'stars'}
              </span>
              <div className="h-2 flex-1 rounded-full bg-[#F7F7F8]" aria-hidden="true">
                <div className="h-2 rounded-full bg-[#4F46E5]" style={{ width: `${percent}%` }} />
              </div>
              <span className="w-8 text-right text-[#1F1F1F]">{starCount}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
