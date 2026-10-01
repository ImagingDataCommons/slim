/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import type { SegmentStyle, SegmentStyleChange } from '../types/layerStyles'
import { buildSegmentDisplayOptions } from '../utils/displayOptions'
import { bindDisplayOptions } from '../utils/displayOptionsBinding'
import SegmentItem from './SegmentItem'
import { BulkVisibilityControl } from './slim/BulkVisibilityControl'
import { DisplayOptionsPanel } from './slim/DisplayOptionsPanel'

export interface SegmentDisplaySettings {
  interpolationEnabled: boolean
}

export interface SegmentListProps {
  segments: dmv.segment.Segment[]
  visibleSegmentUIDs: Set<string>
  metadata: {
    [segmentUID: string]: dmv.metadata.Segmentation[]
  }
  defaultSegmentStyles: {
    [segmentUID: string]: SegmentStyle
  }
  onSegmentVisibilityChange: (change: {
    segmentUID: string
    isVisible: boolean
  }) => void
  onSegmentStyleChange: (change: {
    segmentUID: string
    styleOptions: SegmentStyleChange
  }) => void
  onSegmentClick: (segmentUID: string) => void
  /** Interpolation setting; the display options panel is hidden when omitted */
  displaySettings?: SegmentDisplaySettings
  onDisplaySettingsChange?: (settings: SegmentDisplaySettings) => void
}

/** Segments of the selected segmentation series. */
function SegmentList({
  segments,
  visibleSegmentUIDs,
  metadata,
  defaultSegmentStyles,
  onSegmentVisibilityChange,
  onSegmentStyleChange,
  onSegmentClick,
  displaySettings,
  onDisplaySettingsChange,
}: SegmentListProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <BulkVisibilityControl
        uids={segments.map((segment) => segment.uid)}
        visibleUids={visibleSegmentUIDs}
        itemLabel="segments"
        onChange={({ uid, isVisible }) =>
          onSegmentVisibilityChange({ segmentUID: uid, isVisible })
        }
      />
      {segments.map((segment) => (
        <SegmentItem
          key={segment.uid}
          segment={segment}
          metadata={metadata[segment.uid]}
          isVisible={visibleSegmentUIDs.has(segment.uid)}
          defaultStyle={defaultSegmentStyles[segment.uid]}
          onVisibilityChange={onSegmentVisibilityChange}
          onStyleChange={onSegmentStyleChange}
          onClick={onSegmentClick}
        />
      ))}
      {displaySettings !== undefined &&
        onDisplaySettingsChange !== undefined && (
          <DisplayOptionsPanel
            options={bindDisplayOptions(
              buildSegmentDisplayOptions(displaySettings),
              displaySettings,
              { interpolation: 'interpolationEnabled' },
              onDisplaySettingsChange,
            )}
          />
        )}
    </div>
  )
}

export default SegmentList
