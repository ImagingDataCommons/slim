export type RoiRemovalScope = 'selected' | 'visible'

export interface RoiRemovalPlan {
  scope: RoiRemovalScope
  /** ROI UIDs to remove from the viewer, in iteration order */
  removedUIDs: string[]
  selectedRoiUIDs: Set<string>
  visibleRoiUIDs: Set<string>
}

/**
 * Remove the selected ROIs, or every visible ROI when none is selected.
 * Removed UIDs leave both sets so hidden or stale UIDs never linger.
 */
export function planRoiRemoval(
  selected: ReadonlySet<string>,
  visible: ReadonlySet<string>,
): RoiRemovalPlan {
  const scope: RoiRemovalScope = selected.size > 0 ? 'selected' : 'visible'
  const removedUIDs = Array.from(scope === 'selected' ? selected : visible)
  const removed = new Set(removedUIDs)
  return {
    scope,
    removedUIDs,
    selectedRoiUIDs: new Set(
      Array.from(selected).filter((uid) => !removed.has(uid)),
    ),
    visibleRoiUIDs: new Set(
      Array.from(visible).filter((uid) => !removed.has(uid)),
    ),
  }
}
