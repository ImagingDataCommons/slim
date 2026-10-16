import { useEffectEvent, useLayoutEffect, useRef } from 'react'

import { subscribeDomEvents } from '../services/dmvEvents'
import {
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

  useLayoutEffect(
    () =>
      subscribeDomEvents(document.body, [
        [
          'keyup',
          (event) => {
            if (!(event instanceof KeyboardEvent)) return
            const action = shortcutForKeyEvent(event)
            if (action !== undefined) onShortcutEvent(action)
          },
        ],
      ]),
    [],
  )
}
