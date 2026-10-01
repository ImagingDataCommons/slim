import type React from 'react'
import { useCallback } from 'react'
import { Input } from './ui/input'
import { Slider } from './ui/slider'

interface ColorSliderProps {
  color: number[]
  onChange: (color: number[]) => void
}

const ColorSlider: React.FC<ColorSliderProps> = ({ color, onChange }) => {
  const handleColorChange = useCallback(
    (index: number, value: number | null): void => {
      if (value !== null) {
        const newColor = [...color]
        newColor[index] = value
        onChange(newColor)
      }
    },
    [color, onChange],
  )

  const createSliderChangeHandler = useCallback(
    (index: number) => {
      return (values: number[]) => handleColorChange(index, values[0])
    },
    [handleColorChange],
  )

  const createInputChangeHandler = useCallback(
    (index: number) => {
      return (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10)
        if (!Number.isNaN(value)) {
          handleColorChange(index, Math.min(255, Math.max(0, value)))
        }
      }
    },
    [handleColorChange],
  )

  const colorLabels = ['Red', 'Green', 'Blue']

  return (
    <div className="flex flex-col gap-2">
      {colorLabels.map((colorLabel, index) => (
        <div
          key={colorLabel}
          className="flex items-center justify-center gap-2"
        >
          <div className="w-12 shrink-0 text-[12px] text-ink-muted">
            {colorLabel}
          </div>
          <div className="flex-1">
            <Slider
              min={0}
              max={255}
              step={1}
              value={[color[index]]}
              onValueChange={createSliderChangeHandler(index)}
              aria-label={colorLabel}
            />
          </div>
          <Input
            type="number"
            min={0}
            max={255}
            aria-label={`${colorLabel} value`}
            className="h-8 w-16 font-mono text-[12px]"
            value={color[index]}
            onChange={createInputChangeHandler(index)}
          />
        </div>
      ))}
    </div>
  )
}

export default ColorSlider
