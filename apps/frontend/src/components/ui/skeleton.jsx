import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }) {
  return <div className={cn('animate-pulse rounded-lg bg-[#F7F7F8]', className)} {...props} />;
}

export { Skeleton };
