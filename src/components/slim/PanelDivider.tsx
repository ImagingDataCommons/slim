import type * as React from 'react'

import { cn } from '../../lib/utils'

export interface PanelDividerProps {
  className?: string
}

/** 1px separator drawn between panel sections */
export function PanelDivider({
  className,
}: PanelDividerProps): React.ReactElement {
  return <div className={cn('mx-3.5 h-px flex-none bg-line-soft', className)} />
}
