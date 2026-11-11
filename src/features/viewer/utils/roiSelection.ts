/**
 * Selection after clicking ROI `uid`: Shift-click adds it to the current
 * selection, a plain click selects only it.
 */
export function nextSelectedRoiUIDs(
  current: ReadonlySet<string>,
  uid: string,
  isAdditive: boolean,
): Set<string> {
  return isAdditive ? new Set([...current, uid]) : new Set([uid])
}
