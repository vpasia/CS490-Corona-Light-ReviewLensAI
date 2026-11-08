import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef(
    ({ className, type = 'text', ...props }, ref) => {
        return (
            <input
                ref={ref}
                type={type}
                className={cn(
                    'flex h-10 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#1F1F1F] placeholder:text-[#6B6B6B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] disabled:cursor-not-allowed disabled:opacity-50',
                    className
                )}
                {...props}
            />
        );
    }
);

Input.displayName = 'Input';

export { Input };
