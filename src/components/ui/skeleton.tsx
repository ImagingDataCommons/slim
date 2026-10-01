import type * as React from 'react'

import { cn } from '../../lib/utils'

/** Pulsing placeholder bar; size it with width/height classes. */
export function Skeleton({
  className,
  style,
}: {
  className?: string
  style?: React.CSSProperties
}): React.ReactElement {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block h-2.5 animate-pulse rounded-full bg-line',
        className,
      )}
      style={style}
    />
  )
}
