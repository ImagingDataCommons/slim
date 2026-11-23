import type * as React from 'react'

import { cn } from '../../lib/utils'
import { Slider } from '../ui/slider'

export interface InlineOpacityRowProps {
  /** Name of the layer; the slider is named "Opacity of <label>" */
  label: string
  opacity: number
  disabled?: boolean
  /** The layer is hidden: the row is shown faded but stays usable */
  dimmed?: boolean
  /** Continuous updates while dragging */
  onChange: (opacity: number) => void
  /** Final value on release or keyboard change */
  onCommit: (opacity: number) => void
}

/** Compact "Opacity ──●── 80%" row shown under a layer row. */
export function InlineOpacityRow({
  label,
  opacity,
  disabled = false,
  dimmed = false,
  onChange,
  onCommit,
}: InlineOpacityRowProps): React.ReactElement {
  return (
    <div
      data-dimmed={dimmed || undefined}
      className={cn(
        'flex items-center gap-2 text-11.5 text-ink-muted transition-opacity',
        dimmed && 'opacity-45 hover:opacity-80 focus-within:opacity-80',
      )}
    >
      Opacity
      <Slider
        className="flex-1"
        min={0}
        max={1}
        step={0.01}
        value={[opacity]}
        disabled={disabled}
        onValueChange={(values) => onChange(values[0])}
        onValueCommit={(values) => onCommit(values[0])}
        aria-label={`Opacity of ${label}`}
      />
      <span className="w-9 text-right font-mono text-ink-body">
        {Math.round(opacity * 100)}%
      </span>
    </div>
  )
}
