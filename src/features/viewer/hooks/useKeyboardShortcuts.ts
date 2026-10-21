import { useEffectEvent, useLayoutEffect, useRef } from 'react'

import { subscribeDomEvents } from '../services/dmvEvents'
import {
  isInsideDialog,
  isModalOpen,
  shortcutForKeyEvent,
  type ViewerShortcutAction,
} from '../utils/keyboardShortcuts'

export interface HeldKeys {
  /** Whether Shift is held, for additive ROI selection */
  isShiftDown: () => boolean
}

/**
 * Track held keys, listening on `document.body` like the DMV viewport does.
 */
export function useHeldKeys(): HeldKeys {
  const keysDownRef = useRef(new Set<string>())

  useLayoutEffect(() => {
    const keysDown = keysDownRef.current
    return subscribeDomEvents(document.body, [
      [
        'keyup',
        (event) => {
          if (event instanceof KeyboardEvent) keysDown.delete(event.key)
        },
      ],
      [
        'keydown',
        (event) => {
          if (event instanceof KeyboardEvent) keysDown.add(event.key)
        },
      ],
    ])
  }, [])

  return {
    isShiftDown: (): boolean => keysDownRef.current.has('Shift'),
  }
}

/**
 * Run viewer shortcuts on key release, listening on `document.body` like the
 * DMV viewport does. `useEffectEvent` keeps the latest handler without
 * re-subscribing.
 */
export function useKeyboardShortcuts(
  onShortcut: (action: ViewerShortcutAction) => void,
): void {
  const onShortcutEvent = useEffectEvent(
    (action: ViewerShortcutAction): void => {
      onShortcut(action)
    },
  )

  useLayoutEffect(() => {
    /**
     * A dialog closes on Escape key-down, so its key-up lands outside it;
     * that Escape answered the dialog and must not also cancel the tool
     */
    let isEscapeForDialog = false
    return subscribeDomEvents(document.body, [
      [
        'keydown',
        (event) => {
          if (!(event instanceof KeyboardEvent) || event.key !== 'Escape') {
            return
          }
          isEscapeForDialog = isInsideDialog(event.target)
        },
      ],
      [
        'keyup',
        (event) => {
          if (!(event instanceof KeyboardEvent)) return
          const action = shortcutForKeyEvent(event)
          if (action === undefined) return
          if (action === 'cancel') {
            const wasForDialog = isEscapeForDialog
            isEscapeForDialog = false
            if (wasForDialog || isInsideDialog(event.target)) return
          } else if (isInsideDialog(event.target) || isModalOpen()) {
            /** An open modal owns the keyboard */
            return
          }
          onShortcutEvent(action)
        },
      ],
    ])
  }, [])
}
