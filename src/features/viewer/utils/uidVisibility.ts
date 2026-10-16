import { startTransition } from 'react'

import { withItem, withoutItem } from './uidSets'

export type SetVisibleUIDs = (
  update: (current: Set<string>) => Set<string>,
) => void

/**
 * Show or hide one overlay UID on the viewer and mirror the result into
 * the panel's visible set.
 */
export function applyUidVisibility({
  uid,
  isVisible,
  show,
  hide,
  setVisibleUIDs,
}: {
  uid: string
  isVisible: boolean
  show: (uid: string) => void
  hide: (uid: string) => void
  setVisibleUIDs: SetVisibleUIDs
}): void {
  if (isVisible) {
    show(uid)
    setVisibleUIDs((current) => withItem(current, uid))
  } else {
    hide(uid)
    setVisibleUIDs((current) => withoutItem(current, uid))
  }
}

/**
 * Mirror a visibility change that already happened in the viewport legend
 * into the panel state, without calling show/hide again.
 */
export function mirrorDmvVisibility(
  setVisibleUIDs: SetVisibleUIDs,
  uid: string | null | undefined,
  isVisible: boolean | null | undefined,
): void {
  if (uid == null || isVisible == null) return
  startTransition(() => {
    setVisibleUIDs((current) =>
      isVisible ? withItem(current, uid) : withoutItem(current, uid),
    )
  })
}
