/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type { Dispatch, SetStateAction } from 'react'

import type { ViewerSession } from '../services/viewerSession'
import { type RoiVisibilityState, styleForRoi } from './roiVisibility'

type RoiStyle = dmv.viewer.ROIStyleOptions

export interface RoiSelection {
  selectedRoiUIDs: Set<string>
  /** Last selected or double-clicked ROI, described in the details dialog */
  selectedRoi?: dmv.roi.ROI
}

/** Select, then give visible unselected ROIs back their own style. */
export function applyRoiSelection(
  session: ViewerSession,
  selection: RoiSelection,
  visibleRoiUIDs: Set<string>,
  defaultRoiStyle: RoiStyle,
  setState: Dispatch<SetStateAction<RoiVisibilityState>>,
  refreshSnapshot: () => void,
): void {
  setState((current) => ({ ...current, ...selection }))
  for (const roi of session.volumeViewer.getAllROIs()) {
    if (
      selection.selectedRoiUIDs.has(roi.uid) ||
      !visibleRoiUIDs.has(roi.uid)
    ) {
      continue
    }
    session.volumeViewer.setROIStyle(
      roi.uid,
      styleForRoi(session, roi, defaultRoiStyle),
    )
  }
  refreshSnapshot()
}
