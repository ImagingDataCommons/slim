import type React from 'react'

import {
  ANNOTATION_GROUP_LABEL_ATTRIBUTE,
  groupHoveredRoisBySeries,
  type HoveredRoi,
  SERIES_DESCRIPTION_ATTRIBUTE,
} from '../features/viewer/utils/hoveredRois'

export interface HoveredRoiTooltipProps {
  xPosition: number
  yPosition: number
  rois: readonly HoveredRoi[]
}

const tooltipStyle: React.CSSProperties = {
  position: 'fixed',
  backgroundColor: 'rgba(230, 230, 230, 0.95)',
  padding: '10px',
  fontWeight: 'bold',
  pointerEvents: 'none',
  borderRadius: '4px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  zIndex: 10000,
  minWidth: '200px',
  maxWidth: '400px',
}

const seriesTitleStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 'bold',
  color: 'rgba(0, 0, 0, 0.8)',
  marginBottom: '8px',
  paddingBottom: '4px',
  borderBottom: '1px solid rgba(0, 0, 0, 0.15)',
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
    <div style={{ marginBottom: isLast ? '0' : '6px', fontSize: '12px' }}>
      <div style={{ fontWeight: 'bold' }}>
        ROI {roi.index}
        {groupLabel !== undefined && (
          <span
            style={{
              fontWeight: 500,
              marginLeft: '6px',
              color: 'rgba(0, 0, 0, 0.7)',
            }}
          >
            - {groupLabel.value}
          </span>
        )}
      </div>
      {otherAttributes.length > 0 && (
        <div
          style={{
            marginLeft: '12px',
            fontSize: '11px',
            color: 'rgba(0, 0, 0, 0.8)',
            marginTop: '2px',
          }}
        >
          {otherAttributes.map((attr) => (
            <div key={`${attr.name}-${roi.roiUid}`}>
              {attr.name}: <span style={{ fontWeight: 500 }}>{attr.value}</span>
            </div>
          ))}
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
    style={{ ...tooltipStyle, top: `${yPosition}px`, left: `${xPosition}px` }}
  >
    {groupHoveredRoisBySeries(rois).map(
      ([seriesDesc, seriesRois], seriesIndex) => (
        <div
          key={seriesDesc}
          style={{ marginBottom: seriesIndex > 0 ? '12px' : '0' }}
        >
          {seriesIndex > 0 && (
            <hr
              style={{
                margin: '10px 0',
                border: 'none',
                borderTop: '1px solid rgba(0, 0, 0, 0.2)',
              }}
            />
          )}
          <div style={seriesTitleStyle}>{seriesDesc}</div>
          <div style={{ marginLeft: '4px' }}>
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
