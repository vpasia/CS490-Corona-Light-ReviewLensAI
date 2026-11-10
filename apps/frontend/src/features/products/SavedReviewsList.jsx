import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { StarRating } from '@/components/ui/star-rating';

function ReviewItem({ review }) {
  const isVerified = review.isVerifiedPurchase === true;

  return (
    <li className="flex flex-col gap-2 border-t border-[#E5E5E5] py-4 first:border-t-0 first:pt-0">
      <StarRating rating={review.rating} />
      {review.title && <p className="font-medium text-[#1F1F1F]">{review.title}</p>}
      {(review.reviewDate || isVerified) && (
        <p className="flex gap-3 text-xs text-[#6B6B6B]">
          {review.reviewDate && <span>{review.reviewDate}</span>}
          {isVerified && <span className="text-[#16A34A]">Verified purchase</span>}
        </p>
      )}
      <p className="whitespace-pre-line break-words text-[#1F1F1F]">{review.text}</p>
    </li>
  );
}

function SavedReviewsContent({ status, reviews, errorMessage, onRetry }) {
  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading saved reviews" className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="We couldn’t load saved reviews"
        message={errorMessage}
        onRetry={onRetry}
        className="border-0 py-8"
      />
    );
  }

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="No reviews imported"
        description="Import reviews to see them here."
        className="border-0 py-8"
      />
    );
  }

  return (
    <ul aria-label="Saved reviews" className="flex flex-col">
      {reviews.map((review) => (
        <ReviewItem key={review.reviewId} review={review} />
      ))}
    </ul>
  );
}

export default function SavedReviewsList({ status, reviews, errorMessage, onRetry }) {
  const count = status === 'ready' && reviews.length > 0 ? ` (${reviews.length})` : '';

  return (
    <section
      aria-labelledby="saved-reviews-heading"
      className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] p-6"
    >
      <h2 id="saved-reviews-heading" className="text-lg font-semibold text-[#1F1F1F]">
        Saved reviews{count}
      </h2>
      <SavedReviewsContent
        status={status}
        reviews={reviews}
        errorMessage={errorMessage}
        onRetry={onRetry}
      />
    </section>
  );
}
