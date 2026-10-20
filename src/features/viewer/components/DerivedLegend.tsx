import type { ReactElement } from 'react'

import { cn } from '../../../lib/utils'
import { lutToCssGradient } from '../../../utils/lutGradient'
import type { DerivedLegendRow } from '../utils/derivedLegend'

export interface DerivedLegendProps {
  rows: readonly DerivedLegendRow[]
  onVisibilityChange: (row: DerivedLegendRow, isVisible: boolean) => void
}

/** Matches ViewportOverlays floating cards. */
const OVERLAY_CARD =
  'rounded-lg border border-line bg-overlay-card/92 shadow-[0_1px_2px_rgb(var(--shadow-color)/0.06)]'

/**
 * Quiet in-viewport color legend for fractional SEG and parametric maps.
 * Click a row to show or hide that overlay.
 */
export function DerivedLegend({
  rows,
  onVisibilityChange,
}: DerivedLegendProps): ReactElement | null {
  const visibleCount = rows.filter((row) => row.isVisible).length
  if (rows.length === 0 || visibleCount === 0) return null

  return (
    <ul
      className={cn(
        'm-0 flex w-full list-none flex-col gap-2.5 px-2.5 py-2',
        OVERLAY_CARD,
      )}
      aria-label="Overlay color legend"
    >
      {rows.map((row) => (
        <li key={`${row.kind}:${row.id}`} className="min-w-0">
          <DerivedLegendRowView
            row={row}
            onVisibilityChange={onVisibilityChange}
          />
        </li>
      ))}
    </ul>
  )
}

function DerivedLegendRowView({
  row,
  onVisibilityChange,
}: {
  row: DerivedLegendRow
  onVisibilityChange: DerivedLegendProps['onVisibilityChange']
}): ReactElement {
  const gradient = lutToCssGradient(row.palette)
  const action = row.isVisible ? 'Hide' : 'Show'

  return (
    <button
      type="button"
      className={cn(
        'flex w-full flex-col gap-1 rounded-md text-left transition-opacity',
        'hover:opacity-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40',
        row.isVisible ? 'opacity-100' : 'opacity-40',
      )}
      title={`${action} ${row.title}`}
      aria-label={`${action} ${row.title}`}
      aria-pressed={row.isVisible}
      onClick={() => onVisibilityChange(row, !row.isVisible)}
    >
      <span
        className="min-w-0 truncate text-12 font-medium text-ink"
        title={row.title}
      >
        {row.title}
      </span>
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-11 text-ink-muted">
          {row.minLabel}
        </span>
        <span
          className={cn(
            'h-1.5 min-w-0 flex-1 rounded-full',
            gradient === '' &&
              'border border-line bg-linear-to-r/srgb from-panel to-ink-muted',
          )}
          style={gradient !== '' ? { background: gradient } : undefined}
          aria-hidden
        />
        <span className="shrink-0 font-mono text-11 text-ink-muted">
          {row.maxLabel}
        </span>
      </div>
    </button>
  )
}
