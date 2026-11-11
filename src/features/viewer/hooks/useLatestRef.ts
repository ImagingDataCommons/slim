import { useLayoutEffect, useRef } from 'react'

/**
 * Ref holding the value of the last committed render, for listeners that
 * subscribe once but must call the current handlers.
 */
export function useLatestRef<T>(value: T): { readonly current: T } {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return ref
}
