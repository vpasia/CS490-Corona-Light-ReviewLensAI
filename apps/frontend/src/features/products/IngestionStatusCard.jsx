import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';

import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';

function describeRun(run) {
  if (!run) {
    return {
      tone: 'neutral',
      title: 'No import yet',
      detail: 'No import has been run for this product yet.',
    };
  }
  if (run.status === 'processing') {
    return {
      tone: 'progress',
      title: 'Import in progress',
      detail: 'ReviewLens is still collecting reviews for this product.',
    };
  }
  if (run.status === 'succeeded') {
    return {
      tone: 'success',
      title: 'Import succeeded',
      detail: run.reused
        ? 'The latest import reused reviews that were already saved.'
        : 'The latest import finished and the reviews are saved.',
    };
  }
  if (run.status === 'failed') {
    return {
      tone: 'danger',
      title: 'Import failed',
      detail:
        run.error?.message ?? 'The latest import could not be completed. Try importing again.',
    };
  }
  return {
    tone: 'neutral',
    title: 'Import status unknown',
    detail: 'We couldn’t tell how the latest import ended.',
  };
}

const TONE_CLASSES = {
  neutral: 'text-[#6B6B6B]',
  progress: 'text-[#4F46E5]',
  success: 'text-[#16A34A]',
  danger: 'text-[#DC2626]',
};

function StatusIcon({ tone }) {
  if (tone === 'progress') {
    return <LoaderCircle className="size-5 shrink-0 animate-spin" aria-hidden="true" />;
  }
  if (tone === 'success') {
    return <CircleCheck className="size-5 shrink-0" aria-hidden="true" />;
  }
  if (tone === 'danger') {
    return <CircleAlert className="size-5 shrink-0" aria-hidden="true" />;
  }
  return null;
}

function StatusContent({ status, latestRun, errorMessage, onRetry }) {
  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading import status" className="flex flex-col gap-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="We couldn’t load the import status"
        message={errorMessage}
        onRetry={onRetry}
        className="border-0 py-6"
      />
    );
  }

  const { tone, title, detail } = describeRun(latestRun);

  return (
    <div role="status" className="flex items-start gap-3">
      <span className={TONE_CLASSES[tone]}>
        <StatusIcon tone={tone} />
      </span>
      <div className="flex flex-col gap-1">
        <p className={`font-medium ${TONE_CLASSES[tone]}`}>{title}</p>
        <p className="text-sm text-[#6B6B6B]">{detail}</p>
      </div>
    </div>
  );
}

export default function IngestionStatusCard({ status, latestRun, errorMessage, onRetry }) {
  return (
    <section
      aria-labelledby="ingestion-status-heading"
      className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] p-6"
    >
      <h2 id="ingestion-status-heading" className="text-lg font-semibold text-[#1F1F1F]">
        Import status
      </h2>
      <StatusContent
        status={status}
        latestRun={latestRun}
        errorMessage={errorMessage}
        onRetry={onRetry}
      />
    </section>
  );
}
