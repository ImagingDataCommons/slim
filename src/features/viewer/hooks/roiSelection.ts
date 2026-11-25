/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'
import type { Dispatch, SetStateAction } from 'react'

import type { ViewerSession } from '../services/viewerSession'
import {
  stylesForRoiSelection,
  visibleUidsAfterSelection,
} from '../utils/roiSelectionStyles'
import { SELECTED_ROI_STYLE } from '../utils/selectedRoiStyle'
import { type RoiVisibilityState, styleForRoi } from './roiVisibility'

type RoiStyle = dmv.viewer.ROIStyleOptions

export interface RoiSelection {
  selectedRoiUIDs: Set<string>
  /** Last selected or double-clicked ROI, described in the details dialog */
  selectedRoi?: dmv.roi.ROI
}

/** Select, highlight selected ROIs, and restore the style of the others. */
export function applyRoiSelection(
  session: ViewerSession,
  selection: RoiSelection,
  visibleRoiUIDs: Set<string>,
  defaultRoiStyle: RoiStyle,
  setState: Dispatch<SetStateAction<RoiVisibilityState>>,
  refreshSnapshot: () => void,
): void {
  const { styles, selectedVisibleUIDs } = stylesForRoiSelection({
    rois: session.volumeViewer.getAllROIs(),
    selectedRoiUIDs: selection.selectedRoiUIDs,
    visibleRoiUIDs,
    selectedStyle: SELECTED_ROI_STYLE,
    styleForRoi: (roi) => styleForRoi(session, roi, defaultRoiStyle),
  })
  for (const { uid, style } of styles) {
    session.volumeViewer.setROIStyle(uid, style)
  }
  setState((current) => ({
    ...current,
    ...selection,
    visibleRoiUIDs: visibleUidsAfterSelection(
      current.visibleRoiUIDs,
      selectedVisibleUIDs,
    ),
  }))
  refreshSnapshot()
}
