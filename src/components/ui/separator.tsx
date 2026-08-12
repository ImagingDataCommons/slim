import * as React from 'react'
import { cn } from '../../lib/utils'

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode
}

/** Plain divider, optionally with a centered label — sharp corners, compact. */
const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, label, ...props }, ref) => {
    if (label == null) {
      return (
        <div
          ref={ref}
          className={cn('h-px w-full bg-neutral-200', className)}
          {...props}
        />
      )
    }
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500',
          className,
        )}
        {...props}
      >
        <span className="h-px flex-1 bg-neutral-200" />
        {label}
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
    )
  },
)
Separator.displayName = 'Separator'

export { Separator }
