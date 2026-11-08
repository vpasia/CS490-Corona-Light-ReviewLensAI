import { CircleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

function FormAlert({ message, className }) {
  if (!message) {
    return null;
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-lg border border-[#DC2626] bg-white p-3 text-sm text-[#DC2626]',
        className,
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export { FormAlert };
