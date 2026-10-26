import type * as React from 'react'

import { cn } from '../../lib/utils'

export interface MonoChipProps {
  children: React.ReactNode
  size?: 'sm' | 'md'
  className?: string
}

/** Compact mono badge for modality codes and similar short tokens. */
export function MonoChip({
  children,
  size = 'md',
  className,
}: MonoChipProps): React.ReactElement {
  return (
    <span
      className={cn(
        'rounded-sm bg-chip font-mono text-11 text-chip-foreground',
        size === 'md' && 'px-1.5 py-[3px] font-semibold leading-none',
        size === 'sm' && 'px-[5px] py-0.5 font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}
