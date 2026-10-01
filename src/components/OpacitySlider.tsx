import type React from 'react'

import { clamp } from '../utils/math'
import { Input } from './ui/input'
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
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = Number.parseFloat(e.target.value)
    if (Number.isNaN(value)) return
    const next = clamp(value, 0, 1)
    onChange(next)
    onCommit(next)
  }

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
      <Input
        type="number"
        min={0}
        max={1}
        step={0.01}
        aria-label={`${label} value`}
        className="h-8 w-16 font-mono text-12"
        value={opacity}
        disabled={disabled}
        onChange={handleInputChange}
      />
    </div>
  )
}

export default OpacitySlider
