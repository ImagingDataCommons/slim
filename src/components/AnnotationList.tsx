/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type React from 'react'

import { usePreferences } from '../features/preferences'
import AnnotationItem from './AnnotationItem'
import { BulkVisibilityControl } from './slim/BulkVisibilityControl'

export interface AnnotationListProps {
  rois: dmv.roi.ROI[]
  selectedRoiUIDs: Set<string>
  visibleRoiUIDs: Set<string>
  /** CSS color of the ROI stroke */
  getRoiColor: (roi: dmv.roi.ROI) => string
  onVisibilityChange: (change: { roiUID: string; isVisible: boolean }) => void
  onSelection: (uid: string) => void
}

/** Region of interest (ROI) rows of the Annotations section. */
function AnnotationList({
  rois,
  selectedRoiUIDs,
  visibleRoiUIDs,
  getRoiColor,
  onVisibilityChange,
  onSelection,
}: AnnotationListProps): React.ReactElement {
  const { units } = usePreferences()

  return (
    <div className="flex flex-col gap-0.5">
      <BulkVisibilityControl
        className="mb-1"
        itemLabel="annotations"
        uids={rois.map((roi) => roi.uid)}
        visibleUids={visibleRoiUIDs}
        onChange={({ uid, isVisible }) =>
          onVisibilityChange({ roiUID: uid, isVisible })
        }
      />
      {rois.map((roi, index) => (
        <AnnotationItem
          key={roi.uid}
          roi={roi}
          index={index}
          color={getRoiColor(roi)}
          isSelected={selectedRoiUIDs.has(roi.uid)}
          isVisible={visibleRoiUIDs.has(roi.uid)}
          units={units}
          onSelection={onSelection}
          onVisibilityChange={onVisibilityChange}
        />
      ))}
    </div>
  )
}

export default AnnotationList
