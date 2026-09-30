// skipcq: JS-C1003
import * as dcmjs from 'dcmjs'
// skipcq: JS-C1003
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import { cn } from '../lib/utils'
import { Icon } from './ui/icon'

const FINDING_CODE_VALUES = new Set(['121071', '276214006'])

const UNIT_LABELS: Record<string, string> = {
  mm2: 'mm²',
  um2: 'µm²',
  mm: 'mm',
  um: 'µm',
}

const GRAPHIC_TYPE_LABELS: Record<string, string> = {
  POINT: 'Point',
  MULTIPOINT: 'Points',
  POLYLINE: 'Line',
  POLYGON: 'Polygon',
  ELLIPSE: 'Ellipse',
  ELLIPSOID: 'Ellipsoid',
}

/** "Polygon · Tumor" from the ROI geometry and its finding evaluation. */
export function describeRoiType(roi: dmv.roi.ROI): string {
  const graphicType = roi.scoord3d?.graphicType ?? ''
  const geometry = GRAPHIC_TYPE_LABELS[graphicType] ?? graphicType
  const finding = roi.evaluations.find(
    (item) =>
      item.ValueType === dcmjs.sr.valueTypes.ValueTypes.CODE &&
      FINDING_CODE_VALUES.has(item.ConceptNameCodeSequence[0].CodeValue),
  ) as dcmjs.sr.valueTypes.CodeContentItem | undefined
  const findingLabel = finding?.ConceptCodeSequence[0]?.CodeMeaning
  return [geometry, findingLabel]
    .filter((part) => part !== undefined && part !== '')
    .join(' · ')
}

/** "Area 2.41 mm²" from the first ROI measurement. */
export function describeRoiMeasurement(roi: dmv.roi.ROI): string | undefined {
  const measurement = roi.measurements[0]
  if (measurement === undefined) return undefined
  const name = measurement.ConceptNameCodeSequence[0]?.CodeMeaning ?? ''
  const measuredValue = measurement.MeasuredValueSequence[0]
  if (measuredValue === undefined) return name
  const value = Number(Number(measuredValue.NumericValue).toPrecision(3))
  const unitCode =
    measuredValue.MeasurementUnitsCodeSequence[0]?.CodeValue ?? ''
  const unit = UNIT_LABELS[unitCode] ?? unitCode
  const label = name.charAt(0).toUpperCase() + name.slice(1)
  return `${label} ${value} ${unit}`.trim()
}

interface AnnotationItemProps {
  roi: dmv.roi.ROI
  index: number
  color: string
  isSelected: boolean
  isVisible: boolean
  onSelection: (uid: string) => void
  onVisibilityChange: ({
    roiUID,
    isVisible,
  }: {
    roiUID: string
    isVisible: boolean
  }) => void
}

/** One ROI row in the Annotations section. */
function AnnotationItem({
  roi,
  index,
  color,
  isSelected,
  isVisible,
  onSelection,
  onVisibilityChange,
}: AnnotationItemProps): React.ReactElement {
  const label = `ROI ${index + 1}`
  const type = describeRoiType(roi)
  const measurement = describeRoiMeasurement(roi)

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-selected',
        isSelected && 'bg-selected',
      )}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={() => onSelection(roi.uid)}
        className="flex min-w-0 flex-1 items-stretch gap-2.5 text-left focus-visible:outline-none"
      >
        <span
          className="w-1 flex-none rounded-sm"
          style={{ background: color }}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline gap-1.5">
            <span className="flex-none font-semibold text-ink">{label}</span>
            {type !== '' && (
              <span className="truncate text-[12px] text-ink-muted">
                {type}
              </span>
            )}
          </span>
          {measurement !== undefined && (
            <span className="font-mono text-[11.5px] text-ink-secondary">
              {measurement}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        title="Show/hide"
        aria-label={isVisible ? `Hide ${label}` : `Show ${label}`}
        onClick={() =>
          onVisibilityChange({ roiUID: roi.uid, isVisible: !isVisible })
        }
        className={cn(
          'grid h-7 w-7 flex-none place-items-center rounded-md transition-colors hover:bg-segmented',
          isVisible ? 'text-ink-secondary' : 'text-ink-fainter',
        )}
      >
        <Icon name={isVisible ? 'visibility' : 'visibility_off'} size={18} />
      </button>
    </div>
  )
}

export default AnnotationItem
