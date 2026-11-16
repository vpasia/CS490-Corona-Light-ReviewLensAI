import { CircleAlert, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function Unavailable({ reviewsStatus }) {
  if (reviewsStatus === 'loading') {
    return <p className="text-sm text-[#6B6B6B]">Checking for saved reviews…</p>;
  }
  if (reviewsStatus === 'error') {
    return (
      <p className="text-sm text-[#6B6B6B]">
        Saved reviews couldn’t be loaded, so questions aren’t available right now.
      </p>
    );
  }
  return (
    <p className="text-sm text-[#6B6B6B]">
      No reviews have been imported for this product yet. Import reviews before asking ReviewLens
      questions.
    </p>
  );
}

function AnswerArea({ status, question, answer, errorMessage }) {
  if (status === 'loading') {
    return (
      <p className="flex items-center gap-2 text-sm text-[#6B6B6B]">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        Analyzing reviews…
      </p>
    );
  }

  if (status === 'error') {
    return (
      <p role="alert" className="flex items-start gap-2 text-sm text-[#DC2626]">
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {errorMessage}
      </p>
    );
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col gap-2 rounded-lg bg-[#F5F5F5] p-4 text-sm">
        <p className="font-medium text-[#1F1F1F]">{question}</p>
        <p className="whitespace-pre-line text-[#1F1F1F]">{answer}</p>
      </div>
    );
  }

  return null;
}

export default function AskPanel({
  productName,
  reviewsStatus,
  reviewCount,
  status,
  question,
  answer,
  errorMessage,
  onAsk,
}) {
  const [draft, setDraft] = useState('');
  const canAsk = reviewsStatus === 'ready' && reviewCount > 0;
  const isLoading = status === 'loading';

  async function handleSubmit(event) {
    event.preventDefault();
    if (await onAsk(draft)) {
      setDraft('');
    }
  }

  return (
    <section
      aria-labelledby="ask-heading"
      className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="ask-heading" className="text-lg font-semibold text-[#1F1F1F]">
          Ask ReviewLens
        </h2>
        <p className="text-sm text-[#6B6B6B]">
          Answers use only the saved reviews for{' '}
          <span className="font-medium text-[#1F1F1F]">{productName}</span>.
        </p>
      </div>

      {canAsk ? (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="ask-question" className="sr-only">
              Your question
            </label>
            <Input
              id="ask-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="What do customers complain about most?"
              disabled={isLoading}
            />
            <Button type="submit" className="h-10 px-4" disabled={isLoading || draft.trim() === ''}>
              Ask
            </Button>
          </form>

          <div aria-live="polite">
            <AnswerArea
              status={status}
              question={question}
              answer={answer}
              errorMessage={errorMessage}
            />
          </div>
        </>
      ) : (
        <Unavailable reviewsStatus={reviewsStatus} />
      )}
    </section>
  );
}
