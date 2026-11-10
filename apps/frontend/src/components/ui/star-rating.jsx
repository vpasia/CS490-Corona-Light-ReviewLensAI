import { Star } from 'lucide-react';

import { cn } from '@/lib/utils';

const STAR_COUNT = 5;

function StarRating({ rating, className }) {
  const filled = Math.round(rating);

  return (
    <div
      role="img"
      aria-label={`Rated ${rating} out of 5`}
      className={cn('flex items-center gap-0.5', className)}
    >
      {Array.from({ length: STAR_COUNT }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={cn(
            'size-4',
            index < filled ? 'fill-[#4F46E5] text-[#4F46E5]' : 'text-[#E5E5E5]',
          )}
        />
      ))}
    </div>
  );
}

export { StarRating };
