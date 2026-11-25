export interface ExternalStore<T> {
  getSnapshot: () => T
  subscribe: (listener: () => void) => () => void
  /** Replace the value; listeners run only when it changes identity */
  set: (next: T) => void
  update: (updater: (current: T) => T) => void
}

/**
 * Minimal store for `useSyncExternalStore`, letting a class component push
 * high-frequency values to one child without re-rendering itself.
 */
export function createExternalStore<T>(initial: T): ExternalStore<T> {
  let value = initial
  const listeners = new Set<() => void>()
  const set = (next: T): void => {
    if (Object.is(next, value)) return
    value = next
    for (const listener of Array.from(listeners)) listener()
  }
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set,
    update: (updater) => set(updater(value)),
  }
}
