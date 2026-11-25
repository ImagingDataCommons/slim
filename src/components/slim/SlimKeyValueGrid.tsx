import * as React from 'react'

import { cn } from '../../lib/utils'
import type { KeyValueItem } from '../../utils/keyValue'
import { withOccurrenceKeys } from '../../utils/occurrenceKeys'

export type { KeyValueItem } from '../../utils/keyValue'

export interface SlimKeyValueGridProps {
  items: KeyValueItem[]
  /**
   * Label column width: 96px for patient/study panels, 104px for
   * specimen/equipment panels (which also use a tighter 6px row gap).
   */
  labelWidth?: 96 | 104
  className?: string
}

/** Two-column label/value grid used throughout the viewer side panels. */
export function SlimKeyValueGrid({
  items,
  labelWidth = 96,
  className,
}: SlimKeyValueGridProps): React.ReactElement {
  const entries = withOccurrenceKeys(items, (item) => item.label)
  return (
    <div
      className={cn(
        'grid gap-x-2.5',
        labelWidth === 104
          ? 'grid-cols-[104px_minmax(0,1fr)] gap-y-1.5'
          : 'grid-cols-[96px_minmax(0,1fr)] gap-y-[7px]',
        className,
      )}
    >
      {entries.map(({ item, key }) => (
        <React.Fragment key={key}>
          <div className="text-12 text-ink-muted">{item.label}</div>
          <div
            className={cn(
              'wrap-break-word text-12.5 text-ink',
              item.mono === true && 'font-mono text-12',
            )}
          >
            {item.value === undefined ||
            item.value === null ||
            item.value === ''
              ? '—'
              : item.value}
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}
