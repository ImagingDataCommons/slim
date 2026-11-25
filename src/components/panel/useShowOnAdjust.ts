import { useRef } from 'react'

export interface ShowOnAdjust {
  /** Call on each slider change; shows the hidden item once per drag */
  onAdjust: () => void
  /** Call when the drag ends, so the next one can show it again */
  onAdjustEnd: () => void
}

/**
 * Adjusting a hidden item (e.g. its opacity) shows it. Changes arrive
 * faster than the item re-renders as visible, so show is asked for once
 * per drag rather than once per change.
 */
export function useShowOnAdjust(
  isVisible: boolean,
  show: () => void,
): ShowOnAdjust {
  const isShowRequestedRef = useRef(false)
  return {
    onAdjust: () => {
      if (isVisible || isShowRequestedRef.current) return
      isShowRequestedRef.current = true
      show()
    },
    onAdjustEnd: () => {
      isShowRequestedRef.current = false
    },
  }
}
