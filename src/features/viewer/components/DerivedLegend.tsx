import type { ReactElement } from 'react'

import { VisibilityToggleButton } from '../../../components/panel/VisibilityToggleButton'
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
 * Eye toggle on each row shows or hides that overlay.
 */
export function DerivedLegend({
  rows,
  onVisibilityChange,
}: DerivedLegendProps): ReactElement | null {
  if (rows.length === 0) return null

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
