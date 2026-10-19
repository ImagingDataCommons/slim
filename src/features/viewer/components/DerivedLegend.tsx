import { type ReactElement, useState } from 'react'

import { VisibilityToggleButton } from '../../../components/panel/VisibilityToggleButton'
import { Icon } from '../../../components/ui/icon'
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
    <div className={cn('flex w-full flex-col gap-2 p-2.5', OVERLAY_CARD)}>
      <button
        type="button"
        className="flex min-h-8 w-full items-center justify-between gap-2 rounded-md border border-line-soft bg-app/70 px-2 py-1 text-left transition-colors hover:bg-app"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand legend' : 'Collapse legend'}
        title={collapsed ? 'Expand legend' : 'Collapse legend'}
        onClick={() => setCollapsed((current) => !current)}
      >
        <span className="text-12.5 font-semibold text-ink">
          {collapsed ? `Legend (${visibleCount} visible)` : 'Legend'}
        </span>
        <span
          className="grid size-6 place-items-center rounded-md bg-line-soft text-ink-secondary"
          aria-hidden
        >
          <Icon name={collapsed ? 'chevron_right' : 'expand_more'} size={16} />
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
  const gradient = lutToCssGradient(row.palette)
  const muted = !row.isVisible

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-md border border-line-soft bg-app/50 px-2 py-1.5',
        muted && 'opacity-45',
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="min-w-0 flex-1 truncate text-12.5 font-semibold text-ink"
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
      <div className="flex items-center gap-2">
        <span className="shrink-0 font-mono text-11.5 font-medium text-ink-secondary">
          {row.minLabel}
        </span>
        <div
          className={cn(
            'h-2.5 min-w-0 flex-1 rounded-sm',
            gradient === '' &&
              'border border-line bg-linear-to-r/srgb from-panel to-ink-muted',
          )}
          style={gradient !== '' ? { background: gradient } : undefined}
          aria-hidden
        />
        <span className="shrink-0 font-mono text-11.5 font-medium text-ink-secondary">
          {row.maxLabel}
        </span>
      </div>
    </div>
  )
}
