import { useCallback, useEffect, useRef } from 'react'

/**
 * Wrap `callback` so it runs at most once per animation frame with the most
 * recent arguments. Pending calls are dropped on unmount.
 */
export function useFrameThrottledCallback<A extends unknown[]>(
  callback: (...args: A) => void,
): (...args: A) => void {
  const callbackRef = useRef(callback)
  const frameRef = useRef<number | undefined>(undefined)
  const argsRef = useRef<A | undefined>(undefined)

  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(
    () => () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current)
      }
      /** A remount (StrictMode, Activity) must be able to schedule again */
      frameRef.current = undefined
      argsRef.current = undefined
    },
    [],
  )

  return useCallback((...args: A): void => {
    argsRef.current = args
    if (frameRef.current !== undefined) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = undefined
      const latest = argsRef.current
      argsRef.current = undefined
      if (latest !== undefined) callbackRef.current(...latest)
    })
  }, [])
}
