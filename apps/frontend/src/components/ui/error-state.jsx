import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function ErrorState({ title = 'We couldn’t load this', message, onRetry, className }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-[#E5E5E5] px-6 py-12 text-center',
        className,
      )}
    >
      <p className="text-lg font-semibold text-[#1F1F1F]">{title}</p>
      {message && <p className="text-sm text-[#6B6B6B]">{message}</p>}
      {onRetry && (
        <Button variant="outline" className="h-10 px-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export { ErrorState };
