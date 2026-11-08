import { CircleAlert, LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';

function ImportStatus({ status, importedCount, errorMessage }) {
  if (status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-[#6B6B6B]">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Importing reviews from Amazon…
      </p>
    );
  }

  if (status === 'success') {
    const text =
      importedCount === null
        ? 'Reviews imported just now.'
        : `Imported ${importedCount} ${importedCount === 1 ? 'review' : 'reviews'} just now.`;
    return <p className="text-[#16A34A]">{text}</p>;
  }

  if (status === 'error') {
    return (
      <p role="alert" className="flex items-start gap-2 text-[#DC2626]">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {errorMessage}
      </p>
    );
  }

  return <p className="text-[#6B6B6B]">Ready to import reviews from Amazon.</p>;
}

export default function ImportReviewsPanel({ status, importedCount, errorMessage, onImport }) {
  return (
    <section
      aria-labelledby="import-heading"
      className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="import-heading" className="text-lg font-semibold text-[#1F1F1F]">
          Reviews
        </h2>
        <p className="text-sm text-[#6B6B6B]">
          Import this product’s reviews from Amazon so they can be analyzed.
        </p>
      </div>

      <div aria-live="polite" className="text-sm">
        <ImportStatus status={status} importedCount={importedCount} errorMessage={errorMessage} />
      </div>

      <Button className="h-10 w-fit px-4" disabled={status === 'loading'} onClick={onImport}>
        {status === 'error' ? 'Try again' : 'Import reviews'}
      </Button>
    </section>
  );
}
