import type { VisibilityChange } from '../../../utils/visibility'

/** Copy of `uids` with every change applied in order */
export function applyVisibilityChanges(
  uids: ReadonlySet<string>,
  changes: readonly VisibilityChange[],
): Set<string> {
  const next = new Set(uids)
  for (const { uid, isVisible } of changes) {
    if (isVisible) {
      next.add(uid)
    } else {
      next.delete(uid)
    }
  }
  return next
}

/** Copy of `uids` without the uids the changes hide */
export function removeHiddenUids(
  uids: ReadonlySet<string>,
  changes: readonly VisibilityChange[],
): Set<string> {
  return applyVisibilityChanges(
    uids,
    changes.filter((change) => !change.isVisible),
  )
}
