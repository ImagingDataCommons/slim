import { useState } from 'react'

export type StateUpdater<T> = (update: (previous: T) => T) => void

/**
 * `useState` that restarts from `initial` whenever `resetKey` changes. The
 * reset happens during render, so there is no extra commit with stale state.
 */
export function useResettableState<T>(
  initial: T,
  resetKey?: string,
): [T, StateUpdater<T>] {
  const [state, setState] = useState<{ value: T; resetKey?: string }>({
    value: initial,
    resetKey,
  })
  let value = state.value
  if (state.resetKey !== resetKey) {
    value = initial
    setState({ value: initial, resetKey })
  }
  const updateValue: StateUpdater<T> = (update) => {
    setState((previous) => ({
      resetKey: previous.resetKey,
      value: update(previous.value),
    }))
  }
  return [value, updateValue]
}
