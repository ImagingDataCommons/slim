import { type ReactElement, useId } from 'react'

import { VisibilityToggleButton } from '../../../components/panel/VisibilityToggleButton'
import { Icon } from '../../../components/ui/icon'
import { cn } from '../../../lib/utils'
import { lutToCssGradient } from '../../../utils/lutGradient'
import type { DerivedLegendRow } from '../utils/derivedLegend'

export interface DerivedLegendProps {
  rows: readonly DerivedLegendRow[]
  onVisibilityChange: (row: DerivedLegendRow, isVisible: boolean) => void
  /** Rows hidden behind the header; omitted means expanded */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

/** Matches ViewportOverlays floating cards. */
const OVERLAY_CARD =
  'rounded-lg border border-line bg-overlay-card/92 shadow-[0_1px_2px_rgb(var(--shadow-color)/0.06)]'

/**
 * Quiet in-viewport color legend for fractional SEG and parametric maps.
 * Eye toggle on each row shows or hides that overlay. The header collapses
 * the rows to "Legend (N visible)", as the legend of the classic viewer did.
 */
export function DerivedLegend({
  rows,
  onVisibilityChange,
  collapsed = false,
  onCollapsedChange,
}: DerivedLegendProps): ReactElement | null {
  const listId = useId()
  if (rows.length === 0) return null

  const visibleCount = rows.filter((row) => row.isVisible).length

  return (
    <div
      data-slot="overlay-legend"
      className={cn('flex w-full flex-col px-2.5 py-1.5', OVERLAY_CARD)}
    >
      <button
        type="button"
        className="-mx-1 flex items-center gap-1 rounded px-1 py-0.5 text-left text-11 font-medium uppercase tracking-wide text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        aria-expanded={!collapsed}
        aria-controls={listId}
        onClick={() => onCollapsedChange?.(!collapsed)}
      >
        <span className="min-w-0 flex-1 truncate">
          {collapsed ? `Legend (${visibleCount} visible)` : 'Legend'}
        </span>
        <Icon name={collapsed ? 'expand_more' : 'expand_less'} size={14} />
      </button>
      {/** Kept mounted so the header's aria-controls always resolves */}
      <ul
        id={listId}
        hidden={collapsed}
        className="m-0 flex list-none flex-col gap-2.5 pt-1.5 pb-0.5"
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
  const gradient = lutToCssGradient(row.palette)

  return (
    <div
      className={cn(
        'flex flex-col gap-1',
        row.isVisible ? 'opacity-100' : 'opacity-40',
      )}
    >
      <div className="flex min-w-0 items-center gap-1">
        <span
          className="min-w-0 flex-1 truncate text-12 font-medium text-ink"
          title={row.title}
        >
          {row.title}
        </span>
        <VisibilityToggleButton
          label={row.title}
          isVisible={row.isVisible}
          className="-my-0.5"
          onChange={(isVisible) => onVisibilityChange(row, isVisible)}
        />
      </div>
      <div className="flex items-center gap-2 pr-0.5">
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
    </div>
  )
}
