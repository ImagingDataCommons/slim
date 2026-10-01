import { createExternalStore } from '../externalStore'

describe('createExternalStore', () => {
  it('returns the latest value', () => {
    const store = createExternalStore(1)
    store.set(2)
    expect(store.getSnapshot()).toBe(2)
    store.update((value) => value + 1)
    expect(store.getSnapshot()).toBe(3)
  })

  it('notifies listeners only on change', () => {
    const store = createExternalStore({ x: 1 })
    const listener = jest.fn()
    store.subscribe(listener)
    store.set(store.getSnapshot())
    expect(listener).not.toHaveBeenCalled()
    store.set({ x: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('stops notifying after unsubscribe', () => {
    const store = createExternalStore('a')
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.set('b')
    expect(listener).not.toHaveBeenCalled()
  })
})
