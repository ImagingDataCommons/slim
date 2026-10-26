import type React from 'react'

import {
  ANNOTATION_GROUP_LABEL_ATTRIBUTE,
  groupHoveredRoisBySeries,
  type HoveredRoi,
  SERIES_DESCRIPTION_ATTRIBUTE,
} from '../features/viewer/utils/hoveredRois'
import { cn } from '../lib/utils'
import { withOccurrenceKeys } from '../utils/occurrenceKeys'

export interface HoveredRoiTooltipProps {
  xPosition: number
  yPosition: number
  rois: readonly HoveredRoi[]
}

function HoveredRoiRow({
  roi,
  isLast,
}: {
  roi: HoveredRoi
  isLast: boolean
}): React.ReactElement {
  const groupLabel = roi.attributes.find(
    (attr) => attr.name === ANNOTATION_GROUP_LABEL_ATTRIBUTE,
  )
  const otherAttributes = roi.attributes.filter(
    (attr) =>
      attr.name !== SERIES_DESCRIPTION_ATTRIBUTE &&
      attr.name !== ANNOTATION_GROUP_LABEL_ATTRIBUTE,
  )
  return (
    <div className={cn('text-12', !isLast && 'mb-1.5')}>
      <div className="font-semibold text-ink">
        ROI {roi.index}
        {groupLabel !== undefined && (
          <span className="ml-1.5 font-medium text-ink-secondary">
            - {groupLabel.value}
          </span>
        )}
      </div>
      {otherAttributes.length > 0 && (
        <div className="mt-0.5 ml-3 text-11 text-ink-body">
          {withOccurrenceKeys(otherAttributes, (attr) => attr.name).map(
            ({ item: attr, key }) => (
              <div key={`${key}-${roi.roiUid}`}>
                {attr.name}:{' '}
                <span className="font-medium text-ink">{attr.value}</span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}

/** Pointer-following list of the ROIs under the cursor, grouped by series. */
const HoveredRoiTooltip = ({
  xPosition,
  yPosition,
  rois,
}: HoveredRoiTooltipProps): React.ReactElement => (
  <div
    role="tooltip"
    className="pointer-events-none fixed z-[10000] min-w-[200px] max-w-[400px] rounded-lg border border-line bg-overlay-card/95 p-2.5 shadow-overlay"
    style={{ top: `${yPosition}px`, left: `${xPosition}px` }}
  >
    {groupHoveredRoisBySeries(rois).map(
      ([seriesDesc, seriesRois], seriesIndex) => (
        <div
          key={seriesDesc}
          className={cn(
            seriesIndex > 0 && 'mt-3 border-t border-line-soft pt-2.5',
          )}
        >
          <div className="mb-2 border-b border-line-soft pb-1 text-13 font-semibold text-ink">
            {seriesDesc}
          </div>
          <div className="ml-1">
            {seriesRois.map((roi, roiIndex) => (
              <HoveredRoiRow
                key={roi.roiUid}
                roi={roi}
                isLast={roiIndex === seriesRois.length - 1}
              />
            ))}
          </div>
        </div>
      ),
    )}
  </div>
)

export default HoveredRoiTooltip
