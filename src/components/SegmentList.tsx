/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import type { SegmentStyle, SegmentStyleChange } from '../types/layerStyles'
import { buildSegmentDisplayOptions } from '../utils/displayOptions'
import { bindDisplayOptions } from '../utils/displayOptionsBinding'
import type { VisibilityChange } from '../utils/visibility'
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
  /** "Show all" / "Hide all" in one pass; falls back to one call per item */
  onBulkSegmentVisibilityChange?: (changes: VisibilityChange[]) => void
  onSegmentStyleChange: (change: {
    segmentUID: string
    styleOptions: SegmentStyleChange
  }) => void
  /** Live style while dragging; falls back to onSegmentStyleChange */
  onSegmentStylePreview?: (change: {
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
  onBulkSegmentVisibilityChange,
  onSegmentStyleChange,
  onSegmentStylePreview,
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
        onChange={(changes) => {
          if (onBulkSegmentVisibilityChange !== undefined) {
            onBulkSegmentVisibilityChange(changes)
            return
          }
          for (const { uid, isVisible } of changes) {
            onSegmentVisibilityChange({ segmentUID: uid, isVisible })
          }
        }}
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
          onStylePreview={onSegmentStylePreview}
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
