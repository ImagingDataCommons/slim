import type * as React from 'react'

import { cn } from '../../lib/utils'
import {
  computeBulkVisibility,
  countVisible,
  type VisibilityChange,
} from '../../utils/visibility'

export interface BulkVisibilityControlProps {
  uids: string[]
  visibleUids: Set<string>
  /** Called once per uid whose visibility differs from the target */
  onChange: (change: VisibilityChange) => void
  /** Rendered only for lists of at least this many items */
  minItems?: number
  className?: string
}

const BUTTON_CLASS =
  'rounded px-1.5 py-0.5 font-medium text-primary transition-colors hover:bg-primary-soft disabled:cursor-default disabled:text-ink-fainter disabled:hover:bg-transparent'

/** Compact "n of m visible · Show all · Hide all" row above panel lists. */
export function BulkVisibilityControl({
  uids,
  visibleUids,
  onChange,
  minItems = 2,
  className,
}: BulkVisibilityControlProps): React.ReactElement | null {
  if (uids.length < minItems) return null
  const visibleCount = countVisible(uids, visibleUids)
  const apply = (show: boolean): void => {
    computeBulkVisibility(uids, visibleUids, show).forEach(onChange)
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-1 text-[11.5px] text-ink-muted',
        className,
      )}
    >
      <span className="mr-auto">
        {visibleCount} of {uids.length} visible
      </span>
      <button
        type="button"
        className={BUTTON_CLASS}
        disabled={visibleCount === uids.length}
        onClick={() => apply(true)}
      >
        Show all
      </button>
      <button
        type="button"
        className={BUTTON_CLASS}
        disabled={visibleCount === 0}
        onClick={() => apply(false)}
      >
        Hide all
      </button>
    </div>
  )
}

export default BulkVisibilityControl
