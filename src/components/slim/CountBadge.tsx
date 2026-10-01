import type * as React from 'react'

import { cn } from '../../lib/utils'

export interface CountBadgeProps {
  count: React.ReactNode
  tone?: 'neutral' | 'primary'
  className?: string
}

/** Pill-shaped count shown in panel section headers. */
export function CountBadge({
  count,
  tone = 'neutral',
  className,
}: CountBadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-[3px] text-[11px] font-semibold normal-case leading-none tracking-normal',
        tone === 'primary'
          ? 'bg-primary-soft text-primary'
          : 'bg-chip text-ink-secondary',
        className,
      )}
    >
      {count}
    </span>
  )
}
