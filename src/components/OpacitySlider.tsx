import type React from 'react'

import { clamp } from '../utils/math'
import LimitInput from './slim/LimitInput'
import { Slider } from './ui/slider'

export interface OpacitySliderProps {
  opacity: number
  /** Every value change, including while dragging */
  onChange: (opacity: number) => void
  /** Final value: slider release, keyboard step or typed number */
  onCommit: (opacity: number) => void
  label?: string
  disabled?: boolean
}

/** Labelled 0-1 slider with a numeric field. */
function OpacitySlider({
  opacity,
  onChange,
  onCommit,
  label = 'Opacity',
  disabled = false,
}: OpacitySliderProps): React.ReactElement {
  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-16 shrink-0 text-12 text-ink-muted">{label}</div>
      <div className="flex-1">
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[opacity]}
          disabled={disabled}
          onValueChange={(values) => onChange(values[0])}
          onValueCommit={(values) => onCommit(values[0])}
          aria-label={label}
        />
      </div>
      <LimitInput
        min={0}
        max={1}
        step={0.01}
        aria-label={`${label} value`}
        className="w-16"
        value={opacity}
        disabled={disabled}
        onCommit={(value) => {
          const next = clamp(value, 0, 1)
          onChange(next)
          onCommit(next)
        }}
      />
    </div>
  )
}

export default OpacitySlider
