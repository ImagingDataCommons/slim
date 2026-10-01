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
  /** Called once with every uid whose visibility differs from the target */
  onChange: (changes: VisibilityChange[]) => void
  /** Plural noun for the accessible names, e.g. "segments" in "Show all segments" */
  itemLabel?: string
  className?: string
}

const BUTTON_CLASS =
  'rounded px-1.5 py-0.5 font-medium text-primary transition-colors hover:bg-primary-soft disabled:cursor-default disabled:text-ink-fainter disabled:hover:bg-transparent'

/** Compact "n of m visible · Show all · Hide all" row above panel lists. */
export function BulkVisibilityControl({
  uids,
  visibleUids,
  onChange,
  itemLabel = 'items',
  className,
}: BulkVisibilityControlProps): React.ReactElement | null {
  if (uids.length < 2) return null
  const visibleCount = countVisible(uids, visibleUids)
  const apply = (show: boolean): void => {
    const changes = computeBulkVisibility(uids, visibleUids, show)
    if (changes.length > 0) onChange(changes)
  }

  return (
    <fieldset
      aria-label={`Visibility of ${itemLabel}`}
      className={cn(
        'flex min-w-0 items-center gap-1 px-1 text-[11.5px] text-ink-muted',
        className,
      )}
    >
      <span className="mr-auto">
        {visibleCount} of {uids.length} visible
      </span>
      <button
        type="button"
        className={BUTTON_CLASS}
        aria-label={`Show all ${itemLabel}`}
        disabled={visibleCount === uids.length}
        onClick={() => apply(true)}
      >
        Show all
      </button>
      <button
        type="button"
        className={BUTTON_CLASS}
        aria-label={`Hide all ${itemLabel}`}
        disabled={visibleCount === 0}
        onClick={() => apply(false)}
      >
        Hide all
      </button>
    </fieldset>
  )
}

export default BulkVisibilityControl
