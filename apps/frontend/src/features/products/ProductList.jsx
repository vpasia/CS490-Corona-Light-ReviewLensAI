import { Link } from 'react-router';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api.js';

const PLATFORM_LABELS = { amazon: 'Amazon' };
const LOAD_ERROR_MESSAGE = 'We couldn’t load your products right now. Please try again.';

function ProductRow({ product }) {
  return (
    <li>
      <Link
        to={`/products/${product.productId}/overview`}
        className="flex flex-col gap-1 rounded-lg border border-[#E5E5E5] p-4 hover:bg-[#F7F7F8]"
      >
        <span className="truncate text-base font-medium text-[#1F1F1F]">{product.productName}</span>
        <span className="text-sm text-[#6B6B6B]">
          {PLATFORM_LABELS[product.platform] ?? product.platform}
        </span>
        <span className="truncate text-xs text-[#6B6B6B]">{product.amazonUrl}</span>
      </Link>
    </li>
  );
}

export default function ProductList({ status, products, error, onRetry }) {
  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading your products" className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (status === 'error') {
    const message = error instanceof ApiError ? error.message : LOAD_ERROR_MESSAGE;
    return <ErrorState message={message} onRetry={onRetry} />;
  }

  if (products.length === 0) {
    return (
      <EmptyState
        title="No products yet"
        description="Add a product above to start analyzing its reviews."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {products.map((product) => (
        <ProductRow key={product.productId} product={product} />
      ))}
    </ul>
  );
}
