/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'
import { memo, useMemo } from 'react'

import { cn } from '../lib/utils'
import {
  describeRoiMeasurement,
  describeRoiType,
  formatRoiAttributes,
  getRoiAttributes,
  type LengthUnit,
} from '../utils/roiDescription'
import { VisibilityToggleButton } from './panel/VisibilityToggleButton'

export interface AnnotationItemProps {
  roi: dmv.roi.ROI
  index: number
  color: string
  isSelected: boolean
  isVisible: boolean
  /** Display unit of lengths and areas */
  units: LengthUnit
  onSelection: (uid: string) => void
  onVisibilityChange: (change: { roiUID: string; isVisible: boolean }) => void
}

/** One ROI row in the Annotations section. */
function AnnotationItem({
  roi,
  index,
  color,
  isSelected,
  isVisible,
  units,
  onSelection,
  onVisibilityChange,
}: AnnotationItemProps): React.ReactElement {
  const label = `ROI ${index + 1}`
  const { type, measurement, details } = useMemo(
    () => ({
      type: describeRoiType(roi),
      measurement: describeRoiMeasurement(roi, { unit: units }),
      details: formatRoiAttributes(getRoiAttributes(roi, { unit: units })),
    }),
    [roi, units],
  )

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
          {details !== '' && (
            <span
              className="truncate text-[11.5px] text-ink-muted"
              title={details}
            >
              {details}
            </span>
          )}
        </span>
      </button>
      <VisibilityToggleButton
        label={label}
        isVisible={isVisible}
        onChange={(nextIsVisible) =>
          onVisibilityChange({ roiUID: roi.uid, isVisible: nextIsVisible })
        }
      />
    </div>
  )
}

export default memo(AnnotationItem)
