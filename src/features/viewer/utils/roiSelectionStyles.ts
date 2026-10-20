/** skipcq: JS-C1003 */
import type * as dmv from 'dicom-microscopy-viewer'

type RoiStyle = dmv.viewer.ROIStyleOptions

/**
 * Style ROIs for a selection change: selected ROIs use `selectedStyle` and
 * other visible ROIs get their own style back. Hidden ROIs are left alone;
 * they are already hidden, and `visibleRoiUIDs` may predate a pending show,
 * so styling them `{}` here could hide an ROI the user just turned on.
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
    if (selectedRoiUIDs.has(roi.uid)) {
      styles.push({ uid: roi.uid, style: selectedStyle })
      selectedVisibleUIDs.push(roi.uid)
    } else if (visibleRoiUIDs.has(roi.uid)) {
      styles.push({ uid: roi.uid, style: styleForRoi(roi) })
    }
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
