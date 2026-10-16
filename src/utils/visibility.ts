export type VisibilityState = 'all' | 'some' | 'none'

export interface VisibilityChange {
  uid: string
  isVisible: boolean
}

function toSet(uids: Iterable<string>): Set<string> {
  return uids instanceof Set ? uids : new Set(uids)
}

/** Visibility changes needed so every listed uid matches `show` */
export function computeBulkVisibility(
  allUids: readonly string[],
  visibleUids: Iterable<string>,
  show: boolean,
): VisibilityChange[] {
  const visible = toSet(visibleUids)
  const seen = new Set<string>()
  const changes: VisibilityChange[] = []
  for (const uid of allUids) {
    if (seen.has(uid)) continue
    seen.add(uid)
    if (visible.has(uid) !== show) {
      changes.push({ uid, isVisible: show })
    }
  }
  return changes
}

export function getVisibilityState(
  allUids: readonly string[],
  visibleUids: Iterable<string>,
): VisibilityState {
  if (allUids.length === 0) return 'none'
  const visible = toSet(visibleUids)
  const visibleCount = allUids.filter((uid) => visible.has(uid)).length
  if (visibleCount === 0) return 'none'
  return visibleCount === allUids.length ? 'all' : 'some'
}

export function countVisible(
  allUids: readonly string[],
  visibleUids: Iterable<string>,
): number {
  const visible = toSet(visibleUids)
  return allUids.filter((uid) => visible.has(uid)).length
}

/** Toggling a partially visible set shows everything */
export function getToggleTarget(state: VisibilityState): boolean {
  return state !== 'all'
}
