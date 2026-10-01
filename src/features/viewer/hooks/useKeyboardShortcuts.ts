import { useCallback, useLayoutEffect, useRef } from 'react'

import { subscribeDomEvents } from '../services/dmvEvents'
import {
  shortcutForKeyEvent,
  type ViewerShortcutAction,
} from '../utils/keyboardShortcuts'
import { useLatestRef } from './useLatestRef'

export interface KeyboardShortcuts {
  /** Whether Shift is held, for additive ROI selection */
  isShiftDown: () => boolean
}

/**
 * Run viewer shortcuts on key release and track held keys, listening on
 * `document.body` like the DMV viewport does.
 */
export function useKeyboardShortcuts(
  onShortcut: (action: ViewerShortcutAction) => void,
): KeyboardShortcuts {
  const keysDownRef = useRef(new Set<string>())
  const onShortcutRef = useLatestRef(onShortcut)

  useLayoutEffect(() => {
    const keysDown = keysDownRef.current
    return subscribeDomEvents(document.body, [
      [
        'keyup',
        (event) => {
          if (!(event instanceof KeyboardEvent)) return
          keysDown.delete(event.key)
          const action = shortcutForKeyEvent(event)
          if (action !== undefined) onShortcutRef.current(action)
        },
      ],
      [
        'keydown',
        (event) => {
          if (event instanceof KeyboardEvent) keysDown.add(event.key)
        },
      ],
    ])
  }, [onShortcutRef])

  const isShiftDown = useCallback(
    (): boolean => keysDownRef.current.has('Shift'),
    [],
  )
  return { isShiftDown }
}
