import type React from 'react'

import type { RGB } from '../types/layerStyles'
import { withChannel } from '../utils/color'
import { Input } from './ui/input'
import { Slider } from './ui/slider'

export interface ColorSliderProps {
  color: RGB
  /** Every value change, including while dragging */
  onChange: (color: RGB) => void
  /** Final value: slider release, keyboard step or typed number */
  onCommit: (color: RGB) => void
}

const CHANNELS = [
  { label: 'Red', index: 0 },
  { label: 'Green', index: 1 },
  { label: 'Blue', index: 2 },
] as const

/** Red, green and blue 0-255 sliders with numeric fields. */
function ColorSlider({
  color,
  onChange,
  onCommit,
}: ColorSliderProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      {CHANNELS.map(({ label, index }) => (
        <div key={label} className="flex items-center justify-center gap-2">
          <div className="w-12 shrink-0 text-[12px] text-ink-muted">
            {label}
          </div>
          <div className="flex-1">
            <Slider
              min={0}
              max={255}
              step={1}
              value={[color[index]]}
              onValueChange={(values) =>
                onChange(withChannel(color, index, values[0]))
              }
              onValueCommit={(values) =>
                onCommit(withChannel(color, index, values[0]))
              }
              aria-label={label}
            />
          </div>
          <Input
            type="number"
            min={0}
            max={255}
            aria-label={`${label} value`}
            className="h-8 w-16 font-mono text-[12px]"
            value={color[index]}
            onChange={(e) => {
              const value = Number.parseInt(e.target.value, 10)
              if (Number.isNaN(value)) return
              const next = withChannel(color, index, value)
              onChange(next)
              onCommit(next)
            }}
          />
        </div>
      ))}
    </div>
  )
}

export default ColorSlider
