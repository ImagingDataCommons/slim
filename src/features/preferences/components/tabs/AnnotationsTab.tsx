import type * as React from 'react'
import { useId } from 'react'

import { Button } from '../../../../components/ui/button'
import { SegmentedControl } from '../../../../components/ui/segmented'
import { Slider } from '../../../../components/ui/slider'
import { Switch } from '../../../../components/ui/switch'
import {
  defaultAnnotationPreferences,
  MARKUP_LABEL_FONT_SIZE_MAX,
  MARKUP_LABEL_FONT_SIZE_MIN,
  type MeasurementUnit,
  previewAnnotationPreferences,
  previewDrawStylePreferences,
  ROI_FILL_OPACITY_MAX,
  ROI_FILL_OPACITY_MIN,
  STROKE_COLORS,
  type UserPreferences,
} from '../../utils/preferences'
import { PreferenceRow, SectionLabel } from '../PreferenceRow'

function previewDrawStyle(draft: UserPreferences): void {
  previewDrawStylePreferences({
    strokeColor: draft.strokeColor,
    strokeWidth: draft.strokeWidth,
    roiFill: draft.roiFill,
    roiFillOpacity: draft.roiFillOpacity,
  })
}

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
  /** Restore annotation fields on the draft to factory defaults */
  onResetDefaults: () => void
}

export function AnnotationsTab({
  draft,
  onChange,
  onResetDefaults,
}: AnnotationsTabProps): React.ReactElement {
  const strokeWidthLabelId = useId()
  const fillOpacityLabelId = useId()
  const labelFontSizeLabelId = useId()

  const resetToDefaults = (): void => {
    onResetDefaults()
    const defaults = defaultAnnotationPreferences()
    previewDrawStylePreferences({
      strokeColor: defaults.strokeColor,
      strokeWidth: defaults.strokeWidth,
      roiFill: defaults.roiFill,
      roiFillOpacity: defaults.roiFillOpacity,
    })
    previewAnnotationPreferences({
      markupLabelColor: defaults.markupLabelColor,
      markupLabelFontSize: defaults.markupLabelFontSize,
      units: defaults.units,
    })
  }

  const setMarkupLabelColor = (color: string): void => {
    onChange('markupLabelColor', color)
    previewAnnotationPreferences({
      markupLabelColor: color,
      markupLabelFontSize: draft.markupLabelFontSize,
      units: draft.units,
    })
  }

  const setMarkupLabelFontSize = (size: number): void => {
    onChange('markupLabelFontSize', size)
    previewAnnotationPreferences({
      markupLabelColor: draft.markupLabelColor,
      markupLabelFontSize: size,
      units: draft.units,
    })
  }

  const setUnits = (units: MeasurementUnit): void => {
    onChange('units', units)
    previewAnnotationPreferences({
      markupLabelColor: draft.markupLabelColor,
      markupLabelFontSize: draft.markupLabelFontSize,
      units,
    })
  }

  return (
    <>
      <SectionLabel>Drawing style</SectionLabel>
      <PreferenceRow
        label="Use finding colors"
        description="New ROIs of a finding with a color in the site configuration use that color"
      >
        {(controlProps) => (
          <Switch
            {...controlProps}
            size="lg"
            checked={draft.useFindingColors}
            onCheckedChange={(value) => onChange('useFindingColors', value)}
          />
        )}
      </PreferenceRow>
      <div className="flex flex-col gap-2.5 border-b border-line-soft py-3">
        <div>
          <div className="font-medium text-ink">Stroke color</div>
          <div className="mt-0.5 text-12 text-ink-muted">
            {draft.useFindingColors
              ? 'Outline color for new ROIs whose finding has no configured color'
              : 'Outline color for every new ROI you draw'}
          </div>
        </div>
        <div className="flex gap-2">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Stroke color ${color}`}
              aria-pressed={draft.strokeColor === color}
              onClick={() => {
                onChange('strokeColor', color)
                previewDrawStyle({ ...draft, strokeColor: color })
              }}
              className="h-7 w-7 rounded-full border-2 border-panel focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
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
      <div className="flex flex-col gap-2.5 border-b border-line-soft py-3">
        <div>
          <div id={strokeWidthLabelId} className="font-medium text-ink">
            Stroke width
          </div>
          <div className="mt-0.5 text-12 text-ink-muted">
            Applied to every new ROI you draw, including configured findings
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            aria-labelledby={strokeWidthLabelId}
            min={1}
            max={6}
            step={1}
            value={[draft.strokeWidth]}
            onValueChange={(values) => {
              const [value] = values
              if (value === undefined) return
              onChange('strokeWidth', value)
              previewDrawStyle({ ...draft, strokeWidth: value })
            }}
            className="w-[180px]"
          />
          <span className="w-9 text-right font-mono text-12 font-medium">
            {draft.strokeWidth} px
          </span>
        </div>
      </div>
      <PreferenceRow
        label="Fill shape"
        description="Paint the interior of new polygons and circles"
      >
        {(controlProps) => (
          <Switch
            {...controlProps}
            size="lg"
            checked={draft.roiFill}
            onCheckedChange={(value) => {
              onChange('roiFill', value)
              previewDrawStyle({ ...draft, roiFill: value })
            }}
          />
        )}
      </PreferenceRow>
      <div className="flex flex-col gap-2.5 border-b border-line-soft py-3">
        <div>
          <div id={fillOpacityLabelId} className="font-medium text-ink">
            Fill opacity
          </div>
          <div className="mt-0.5 text-12 text-ink-muted">
            Interior transparency for new filled ROIs
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            aria-labelledby={fillOpacityLabelId}
            min={ROI_FILL_OPACITY_MIN}
            max={ROI_FILL_OPACITY_MAX}
            step={0.05}
            value={[draft.roiFillOpacity]}
            disabled={!draft.roiFill}
            onValueChange={(values) => {
              const [value] = values
              if (value === undefined) return
              onChange('roiFillOpacity', value)
              previewDrawStyle({ ...draft, roiFillOpacity: value })
            }}
            className="w-[180px]"
          />
          <span className="w-12 text-right font-mono text-12 font-medium">
            {Math.round(draft.roiFillOpacity * 100)}%
          </span>
        </div>
      </div>
      <SectionLabel>Measurements</SectionLabel>
      <div className="flex flex-col gap-2.5 border-b border-line-soft py-3">
        <div>
          <div className="font-medium text-ink">Measurement label color</div>
          <div className="mt-0.5 text-12 text-ink-muted">
            Value label and dotted link line on the slide
          </div>
        </div>
        <div className="flex gap-2">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Measurement label color ${color}`}
              aria-pressed={draft.markupLabelColor === color}
              onClick={() => setMarkupLabelColor(color)}
              className="h-7 w-7 rounded-full border-2 border-panel focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
              style={{
                backgroundColor: color,
                boxShadow:
                  draft.markupLabelColor === color
                    ? `0 0 0 2px ${color}`
                    : '0 0 0 1px rgb(var(--line-input))',
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 border-b border-line-soft py-3">
        <div>
          <div id={labelFontSizeLabelId} className="font-medium text-ink">
            Measurement label size
          </div>
          <div className="mt-0.5 text-12 text-ink-muted">
            Font size of the value label on the slide
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Slider
            aria-labelledby={labelFontSizeLabelId}
            min={MARKUP_LABEL_FONT_SIZE_MIN}
            max={MARKUP_LABEL_FONT_SIZE_MAX}
            step={1}
            value={[draft.markupLabelFontSize]}
            onValueChange={(values) => {
              const [value] = values
              if (value !== undefined) setMarkupLabelFontSize(value)
            }}
            className="w-[180px]"
          />
          <span className="w-9 text-right font-mono text-12 font-medium">
            {draft.markupLabelFontSize} px
          </span>
        </div>
      </div>
      <PreferenceRow
        label="Measurement units"
        description="On-slide measurement labels, annotation list, and ROI details"
      >
        {() => (
          <SegmentedControl
            fill
            className="w-40"
            aria-label="Measurement units"
            value={draft.units}
            onChange={setUnits}
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
      <div className="flex flex-col gap-2.5 border-t border-line-soft py-4">
        <div>
          <div className="font-medium text-ink">Reset annotation settings</div>
          <div className="mt-0.5 text-12 text-ink-muted">
            Restore drawing style, measurements, and editing options to the
            built-in defaults. Other preferences are unchanged. Save to keep the
            reset.
          </div>
        </div>
        <div>
          <Button type="button" variant="outline" onClick={resetToDefaults}>
            Reset to defaults
          </Button>
        </div>
      </div>
    </>
  )
}
