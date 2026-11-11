/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

import {
  SELECTION_FILL_COLOR,
  SELECTION_STROKE_COLOR,
} from '../../../components/SlideViewer/constants'

type RoiStyle = dmv.viewer.ROIStyleOptions

/** Style applied to the currently selected ROI(s). */
export const SELECTED_ROI_STYLE: RoiStyle = {
  stroke: { color: [...SELECTION_STROKE_COLOR, 1], width: 3 },
  fill: { color: [...SELECTION_FILL_COLOR, 0.5] },
  image: {
    circle: {
      radius: 5,
      fill: { color: [...SELECTION_STROKE_COLOR, 1] },
    },
  },
}
