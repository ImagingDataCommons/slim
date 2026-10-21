import { startTransition } from 'react'

import type { VisibilityChange } from '../../../utils/visibility'
import { applyEach } from './applyEach'
import { withItem, withoutItem } from './uidSets'
import { applyVisibilityChanges } from './visibilityChanges'

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
 * Show or hide several overlay UIDs ("Show all" / "Hide all") and commit
 * the panel's visible set once. Changes before a failing one still apply.
 */
export function applyUidVisibilityChanges({
  changes,
  show,
  hide,
  setVisibleUIDs,
}: {
  changes: readonly VisibilityChange[]
  show: (uid: string) => void
  hide: (uid: string) => void
  setVisibleUIDs: SetVisibleUIDs
}): void {
  applyEach(
    changes,
    (change): VisibilityChange => {
      if (change.isVisible) show(change.uid)
      else hide(change.uid)
      return change
    },
    (applied) => {
      if (applied.length === 0) return
      setVisibleUIDs((current) => applyVisibilityChanges(current, applied))
    },
  )
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
