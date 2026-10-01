import type React from 'react'
import { Input } from './ui/input'
import { Slider } from './ui/slider'

interface OpacitySliderProps {
  opacity: number
  onChange: (opacity: number | null) => void
  label?: string
}

const OpacitySlider: React.FC<OpacitySliderProps> = ({
  opacity,
  onChange,
  label = 'Opacity',
}) => {
  const handleSliderChange = (values: number[]): void => {
    onChange(values[0])
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = parseFloat(e.target.value)
    if (!Number.isNaN(value)) {
      onChange(Math.min(1, Math.max(0, value)))
    }
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <div className="w-16 shrink-0 text-[12px] text-ink-muted">{label}</div>
      <div className="flex-1">
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[opacity]}
          onValueChange={handleSliderChange}
          aria-label={label}
        />
      </div>
      <Input
        type="number"
        min={0}
        max={1}
        step={0.01}
        aria-label={`${label} value`}
        className="h-8 w-16 font-mono text-[12px]"
        value={opacity}
        onChange={handleInputChange}
      />
    </div>
  )
}

export default OpacitySlider
