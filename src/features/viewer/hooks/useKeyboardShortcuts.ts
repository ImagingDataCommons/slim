import { useCallback, useLayoutEffect, useRef } from 'react'

import { subscribeDomEvents } from '../services/dmvEvents'
import {
  shortcutForKeyEvent,
  type ViewerShortcutAction,
} from '../utils/keyboardShortcuts'
import { useLatestRef } from './useLatestRef'

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

  const isShiftDown = useCallback(
    (): boolean => keysDownRef.current.has('Shift'),
    [],
  )
  return { isShiftDown }
}

/**
 * Run viewer shortcuts on key release, listening on `document.body` like the
 * DMV viewport does.
 */
export function useKeyboardShortcuts(
  onShortcut: (action: ViewerShortcutAction) => void,
): void {
  const onShortcutRef = useLatestRef(onShortcut)

  useLayoutEffect(
    () =>
      subscribeDomEvents(document.body, [
        [
          'keyup',
          (event) => {
            if (!(event instanceof KeyboardEvent)) return
            const action = shortcutForKeyEvent(event)
            if (action !== undefined) onShortcutRef.current(action)
          },
        ],
      ]),
    [onShortcutRef],
  )
}
