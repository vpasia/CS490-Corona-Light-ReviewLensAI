import { Link, useParams } from 'react-router';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api.js';

import ImportReviewsPanel from './ImportReviewsPanel.jsx';
import { useImportReviews } from './useImportReviews.js';
import { useProduct } from './useProduct.js';

const PLATFORM_LABELS = { amazon: 'Amazon' };
const LOAD_ERROR_MESSAGE = 'We couldn’t load this product right now. Please try again.';

function BackLink() {
  return (
    <Link to="/" className="text-sm text-[#4F46E5] hover:underline">
      Back to your products
    </Link>
  );
}

function ProductWorkspace({ productId }) {
  const { status, product, error, retry } = useProduct(productId);
  const importer = useImportReviews(productId);

  if (status === 'loading') {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
        <div role="status" aria-label="Loading product" className="flex flex-col gap-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-40 w-full" />
        </div>
      </main>
    );
  }

  if (status === 'notFound') {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
        <EmptyState
          title="Product not found"
          description="This product doesn’t exist or isn’t in your account."
          action={<BackLink />}
        />
      </main>
    );
  }

  if (status === 'error') {
    const message = error instanceof ApiError ? error.message : LOAD_ERROR_MESSAGE;
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
        <ErrorState message={message} onRetry={retry} />
        <BackLink />
      </main>
    );
  }

  const isWebLink = /^https?:\/\//i.test(product.amazonUrl);

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-12">
      <BackLink />

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-[#1F1F1F]">{product.productName}</h1>
        <p className="text-sm text-[#6B6B6B]">
          Platform: {PLATFORM_LABELS[product.platform] ?? product.platform}
        </p>
        <p className="truncate text-sm text-[#6B6B6B]">
          Source:{' '}
          {isWebLink ? (
            <a
              href={product.amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#4F46E5] hover:underline"
            >
              {product.amazonUrl}
            </a>
          ) : (
            product.amazonUrl
          )}
        </p>
      </header>

      <ImportReviewsPanel
        status={importer.status}
        importedCount={importer.importedCount}
        errorMessage={importer.errorMessage}
        onImport={importer.start}
      />
    </main>
  );
}

export default function ProductWorkspacePage() {
  const { productId } = useParams();

  return <ProductWorkspace key={productId} productId={productId} />;
}
