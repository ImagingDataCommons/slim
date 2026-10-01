import type * as React from 'react'
import { useId } from 'react'

import { SegmentedControl } from '../../../../components/ui/segmented'
import { Slider } from '../../../../components/ui/slider'
import { Switch } from '../../../../components/ui/switch'
import {
  type MeasurementUnit,
  STROKE_COLORS,
  type UserPreferences,
} from '../../utils/preferences'
import { PreferenceRow, SectionLabel } from '../PreferenceRow'

const UNIT_OPTIONS: Array<{ value: MeasurementUnit; label: string }> = [
  { value: 'µm', label: 'µm' },
  { value: 'mm', label: 'mm' },
]

export interface AnnotationsTabProps {
  draft: UserPreferences
  onChange: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => void
}

export function AnnotationsTab({
  draft,
  onChange,
}: AnnotationsTabProps): React.ReactElement {
  const strokeWidthLabelId = useId()
  return (
    <>
      <SectionLabel>Drawing style</SectionLabel>
      <div className="flex flex-col gap-2.5 border-b border-line-soft py-3">
        <div>
          <div className="font-medium text-ink">Stroke color</div>
          <div className="mt-0.5 text-12 text-ink-muted">
            Applied to new ROIs you draw
          </div>
        </div>
        <div className="flex gap-2">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Stroke color ${color}`}
              aria-pressed={draft.strokeColor === color}
              onClick={() => onChange('strokeColor', color)}
              className="h-7 w-7 rounded-full border-2 border-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              style={{
                backgroundColor: color,
                boxShadow:
                  draft.strokeColor === color
                    ? `0 0 0 2px ${color}`
                    : '0 0 0 1px rgb(var(--line-input))',
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 border-b border-line-soft py-3">
        <div id={strokeWidthLabelId} className="flex-1 font-medium text-ink">
          Stroke width
        </div>
        <Slider
          aria-labelledby={strokeWidthLabelId}
          min={1}
          max={6}
          step={1}
          value={[draft.strokeWidth]}
          onValueChange={(values) => {
            const [value] = values
            if (value !== undefined) onChange('strokeWidth', value)
          }}
          className="w-[180px]"
        />
        <span className="w-9 text-right font-mono text-12 font-medium">
          {draft.strokeWidth} px
        </span>
      </div>
      <SectionLabel>Measurements</SectionLabel>
      <PreferenceRow
        label="Measurement units"
        description="Lengths and areas in the annotation list and ROI details"
      >
        {() => (
          <SegmentedControl
            fill
            className="w-40"
            aria-label="Measurement units"
            value={draft.units}
            onChange={(value) => onChange('units', value)}
            options={UNIT_OPTIONS}
          />
        )}
      </PreferenceRow>
      <SectionLabel>Editing</SectionLabel>
      <PreferenceRow
        label="Confirm before removing"
        description="Ask before deleting a selected ROI"
      >
        {(controlProps) => (
          <Switch
            {...controlProps}
            size="lg"
            checked={draft.confirmRoiRemoval}
            onCheckedChange={(value) => onChange('confirmRoiRemoval', value)}
          />
        )}
      </PreferenceRow>
    </>
  )
}
