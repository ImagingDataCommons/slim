import type React from 'react'
import { FiSettings } from 'react-icons/fi'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Separator } from './ui/separator'
import { Slider } from './ui/slider'
import { Switch } from './ui/switch'

export interface MeasurementOption {
  key: string
  meaning: string
  schemeDesignator: string
  codeValue: string
}

interface RowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

/** Slider + number input pair, label above — one row of the settings form. */
function SettingRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: RowProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-neutral-500">{label}</span>
      <div className="flex items-center gap-2">
        <Slider
          className="flex-1"
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([next]) => onChange(next)}
        />
        <Input
          className="w-14"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => {
            const next = event.target.valueAsNumber
            if (!Number.isNaN(next)) {
              onChange(Math.min(max, Math.max(min, next)))
            }
          }}
        />
      </div>
    </div>
  )
}

interface AnnotationGroupDisplaySettingsProps {
  color?: number[]
  onColorChange: (color: number[]) => void
  opacity: number
  onOpacityChange: (opacity: number) => void
  isClosedGraphicType: boolean
  filled: boolean
  onFilledChange: (filled: boolean) => void
  fillOpacity: number
  onFillOpacityChange: (fillOpacity: number) => void
  measurementOptions: MeasurementOption[]
  selectedMeasurementKey?: string
  onMeasurementChange: (option: MeasurementOption | undefined) => void
  limitValues?: [number, number]
  limitBounds: [number, number]
  onLimitValuesChange: (values: [number, number]) => void
  disabled?: boolean
}

const COLOR_LABELS = ['Red', 'Green', 'Blue']

/**
 * "Display Settings" popover trigger + panel for an annotation group:
 * color, opacity, fill, measurement filtering. Built with Radix primitives
 * + Tailwind (see components/ui/*) rather than antd — kept as its own
 * component so it doesn't touch ColorSlider/OpacitySlider, which are still
 * shared by Segments, Optical Paths, and Mappings.
 */
function AnnotationGroupDisplaySettings({
  color,
  onColorChange,
  opacity,
  onOpacityChange,
  isClosedGraphicType,
  filled,
  onFilledChange,
  fillOpacity,
  onFillOpacityChange,
  measurementOptions,
  selectedMeasurementKey,
  onMeasurementChange,
  limitValues,
  limitBounds,
  onLimitValuesChange,
  disabled = false,
}: AnnotationGroupDisplaySettingsProps): React.ReactElement {
  const [minBound, maxBound] = limitBounds

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label="Display settings">
          <FiSettings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="left" className="w-72 p-3">
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          <span className="text-sm font-semibold text-neutral-800">
            Display Settings
          </span>

          {color != null && color.length === 3 && (
            <div className="flex flex-col gap-2">
              <Separator label="Color" />
              {COLOR_LABELS.map((label, index) => (
                <SettingRow
                  key={label}
                  label={label}
                  value={color[index]}
                  min={0}
                  max={255}
                  step={1}
                  onChange={(next) => {
                    const nextColor = [...color]
                    nextColor[index] = next
                    onColorChange(nextColor)
                  }}
                />
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Separator label="Opacity" />
            <SettingRow
              label="Opacity"
              value={opacity}
              min={0}
              max={1}
              step={0.01}
              onChange={onOpacityChange}
            />
          </div>

          {isClosedGraphicType && (
            <div className="flex flex-col gap-2">
              <Separator label="Fill" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-600">Filled</span>
                <Switch
                  checked={filled}
                  onCheckedChange={onFilledChange}
                  aria-label="Filled"
                />
              </div>
              {filled && (
                <SettingRow
                  label="Fill opacity"
                  value={fillOpacity}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={onFillOpacityChange}
                />
              )}
            </div>
          )}

          {limitValues != null && (
            <div className="flex flex-col gap-2">
              <Separator label="Values of interest" />
              <div className="flex items-center gap-2">
                <Input
                  className="w-16"
                  value={limitValues[0]}
                  min={minBound}
                  max={limitValues[1]}
                  onChange={(event) => {
                    const next = event.target.valueAsNumber
                    if (!Number.isNaN(next)) {
                      onLimitValuesChange([next, limitValues[1]])
                    }
                  }}
                />
                <Slider
                  className="flex-1"
                  value={limitValues}
                  min={minBound}
                  max={maxBound}
                  step={1}
                  onValueChange={(next) =>
                    onLimitValuesChange([next[0], next[1]])
                  }
                />
                <Input
                  className="w-16"
                  value={limitValues[1]}
                  min={limitValues[0]}
                  max={maxBound}
                  onChange={(event) => {
                    const next = event.target.valueAsNumber
                    if (!Number.isNaN(next)) {
                      onLimitValuesChange([limitValues[0], next])
                    }
                  }}
                />
              </div>
            </div>
          )}

          {measurementOptions.length > 0 && (
            <div className="flex flex-col gap-1">
              <Separator label="Exploration" />
              <span className="text-xs text-neutral-500">Measurement</span>
              <select
                className="h-7 w-full border border-neutral-300 bg-white px-1.5 text-xs text-neutral-800 outline-none focus-visible:border-[#007ea3] focus-visible:ring-1 focus-visible:ring-[#007ea3] disabled:cursor-not-allowed disabled:opacity-50"
                value={selectedMeasurementKey ?? ''}
                disabled={disabled}
                onChange={(event) => {
                  const option = measurementOptions.find(
                    (item) => item.key === event.target.value,
                  )
                  onMeasurementChange(option)
                }}
              >
                <option value="">—</option>
                {measurementOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.meaning}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default AnnotationGroupDisplaySettings
