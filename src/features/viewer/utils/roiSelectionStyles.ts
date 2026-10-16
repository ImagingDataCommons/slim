/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

type RoiStyle = dmv.viewer.ROIStyleOptions

/**
 * Style each ROI for a selection change: selected ROIs use `selectedStyle`,
 * other visible ROIs keep their own style, hidden ROIs get an empty style.
 * Also returns which selected ROIs need to become visible.
 */
export function stylesForRoiSelection({
  rois,
  selectedRoiUIDs,
  visibleRoiUIDs,
  selectedStyle,
  styleForRoi,
}: {
  rois: readonly dmv.roi.ROI[]
  selectedRoiUIDs: ReadonlySet<string>
  visibleRoiUIDs: ReadonlySet<string>
  selectedStyle: RoiStyle
  styleForRoi: (roi: dmv.roi.ROI) => RoiStyle
}): {
  styles: Array<{ uid: string; style: RoiStyle }>
  selectedVisibleUIDs: string[]
} {
  const styles: Array<{ uid: string; style: RoiStyle }> = []
  const selectedVisibleUIDs: string[] = []
  for (const roi of rois) {
    let style: RoiStyle = {}
    if (selectedRoiUIDs.has(roi.uid)) {
      style = selectedStyle
      selectedVisibleUIDs.push(roi.uid)
    } else if (visibleRoiUIDs.has(roi.uid)) {
      style = styleForRoi(roi)
    }
    styles.push({ uid: roi.uid, style })
  }
  return { styles, selectedVisibleUIDs }
}

/**
 * Merge selected UIDs into the visible set when selection made them visible.
 * Preserves Set identity when every selected UID was already visible.
 */
export function visibleUidsAfterSelection(
  visibleRoiUIDs: ReadonlySet<string>,
  selectedVisibleUIDs: readonly string[],
): Set<string> {
  if (selectedVisibleUIDs.every((uid) => visibleRoiUIDs.has(uid))) {
    return visibleRoiUIDs instanceof Set
      ? visibleRoiUIDs
      : new Set(visibleRoiUIDs)
  }
  return new Set([...visibleRoiUIDs, ...selectedVisibleUIDs])
}
