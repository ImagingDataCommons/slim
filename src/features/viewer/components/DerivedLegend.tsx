import { type ReactElement, useState } from 'react'

import { cn } from '../../../lib/utils'
import { type DerivedLegendRow, paletteGradient } from '../utils/derivedLegend'

export interface DerivedLegendProps {
  rows: readonly DerivedLegendRow[]
  onVisibilityChange: (row: DerivedLegendRow, isVisible: boolean) => void
}

const CARD =
  'rounded-lg border border-line bg-overlay-card/94 shadow-[0_1px_2px_rgb(var(--shadow-color)/0.08)]'

/**
 * In-viewport color legend for fractional SEG and parametric maps. Replaces
 * DMV's built-in overlay when `showDerivedLegend: false` is set on the viewer.
 */
export function DerivedLegend({
  rows,
  onVisibilityChange,
}: DerivedLegendProps): ReactElement | null {
  const [collapsed, setCollapsed] = useState(false)
  const visibleCount = rows.filter((row) => row.isVisible).length
  if (rows.length === 0 || visibleCount === 0) return null

  return (
    <div
      className={cn(
        'pointer-events-auto absolute top-16 left-3.5 z-10 flex min-w-[220px] max-w-[min(420px,calc(100%-1.75rem))] flex-col gap-2 p-2',
        CARD,
      )}
    >
      <button
        type="button"
        className="flex min-h-7 w-full items-center justify-between gap-2.5 rounded-md border border-line-soft bg-app/60 px-1.5 py-1 text-left"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
        title={collapsed ? 'Expand legend' : 'Collapse legend'}
        onClick={() => setCollapsed((current) => !current)}
      >
        <span className="text-13 font-semibold text-ink">
          {collapsed ? `Legend (${visibleCount} visible)` : 'Legend'}
        </span>
        <span
          className="grid size-[22px] place-items-center rounded-sm bg-line-soft text-16 font-bold text-ink-secondary"
          aria-hidden
        >
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {!collapsed &&
        rows.map((row) => (
          <DerivedLegendRowView
            key={`${row.kind}:${row.id}`}
            row={row}
            onVisibilityChange={onVisibilityChange}
          />
        ))}
    </div>
  )
}

function DerivedLegendRowView({
  row,
  onVisibilityChange,
}: {
  row: DerivedLegendRow
  onVisibilityChange: DerivedLegendProps['onVisibilityChange']
}): ReactElement {
  const muted = row.isVisible ? 'opacity-100' : 'opacity-40'
  return (
    <div className="flex w-full items-center gap-2">
      <input
        type="checkbox"
        className="size-3.5 shrink-0 accent-ink-muted"
        checked={row.isVisible}
        aria-label={row.isVisible ? 'Hide overlay' : 'Show overlay'}
        title={row.isVisible ? 'Hide overlay' : 'Show overlay'}
        onChange={(event) => onVisibilityChange(row, event.target.checked)}
      />
      <span
        className={cn(
          'shrink-0 font-mono text-10 font-semibold text-ink',
          muted,
        )}
      >
        {row.minLabel}
      </span>
      <div
        className={cn('h-5 min-w-0 flex-1 rounded-sm', muted)}
        style={{ background: paletteGradient(row.colors) }}
        aria-hidden
      />
      <span
        className={cn(
          'shrink-0 font-mono text-10 font-semibold text-ink',
          muted,
        )}
      >
        {row.maxLabel}
      </span>
      <span
        className={cn(
          'max-w-[9rem] shrink truncate text-12 font-semibold text-ink',
          muted,
        )}
        title={row.title}
      >
        {row.title}
      </span>
    </div>
  )
}
