import { cn } from '@/lib/utils';

function EmptyState({ title, description, action, className }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border border-[#E5E5E5] px-6 py-12 text-center',
        className,
      )}
    >
      <p className="text-lg font-semibold text-[#1F1F1F]">{title}</p>
      {description && <p className="text-sm text-[#6B6B6B]">{description}</p>}
      {action}
    </div>
  );
}

export { EmptyState };
