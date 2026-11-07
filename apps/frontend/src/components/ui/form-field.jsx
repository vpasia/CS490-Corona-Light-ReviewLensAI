import * as React from 'react';

import { cn } from '@/lib/utils';

function FormField({
    label,
    htmlFor,
    error,
    description,
    className,
    children,
}) {
    const errorId = React.useId();
    const descriptionId = React.useId();

    return (
        <div className={cn('flex w-full flex-col gap-2', className)}>
            <label
                htmlFor={htmlFor}
                className="text-sm font-medium text-[#1F1F1F]"
            >
                {label}
            </label>

            {children}

            {description && !error && (
                <p id={descriptionId} className="text-xs text-[#6B6B6B]">
                    {description}
                </p>
            )}

            {error && (
                <p id={errorId} role="alert" className="text-sm text-[#DC2626]">
                    {error}
                </p>
            )}
        </div>
    );
}

export { FormField };
