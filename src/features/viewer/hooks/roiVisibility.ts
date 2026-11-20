/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import { getRoiKey } from '../../../components/SlideViewer/utils/roiUtils'
import type { ViewerSession } from '../services/viewerSession'

type RoiStyle = dmv.viewer.ROIStyleOptions

export interface RoiVisibilityState {
  selectedRoiUIDs: Set<string>
  visibleRoiUIDs: Set<string>
  selectedRoi?: dmv.roi.ROI
}

/** Style an ROI with its registered or default stroke. */
export function styleForRoi(
  session: ViewerSession,
  roi: dmv.roi.ROI,
  defaultRoiStyle: RoiStyle,
): RoiStyle {
  return session.roiStyles.styleForRoi(roi.uid, getRoiKey(roi), defaultRoiStyle)
}
