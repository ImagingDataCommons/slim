import * as React from 'react'

import { cn } from '../../lib/utils'

export type SkeletonProps = React.HTMLAttributes<HTMLSpanElement>

/** Pulsing placeholder bar; size it with width/height classes. */
export const Skeleton = React.forwardRef<HTMLSpanElement, SkeletonProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn(
        'block h-2.5 animate-pulse rounded-full bg-line',
        className,
      )}
      {...props}
    />
  ),
)
Skeleton.displayName = 'Skeleton'
