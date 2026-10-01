import { MAX_VISIBLE_TOASTS, TOAST_DURATION_MS } from '../../utils/toastQueue'
import { createToastStore } from '../toast'

describe('createToastStore', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('publishes toasts and notifies subscribers', () => {
    const store = createToastStore()
    const listener = jest.fn()
    store.subscribe(listener)
    store.publish({ message: 'Saved', tone: 'success' })
    expect(store.getSnapshot()).toEqual([
      { id: 0, message: 'Saved', tone: 'success' },
    ])
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps toasts published before anyone subscribes', () => {
    const store = createToastStore()
    store.publish({ message: 'Early', tone: 'info' })
    const listener = jest.fn()
    store.subscribe(listener)
    expect(store.getSnapshot()).toHaveLength(1)
  })

  it('auto-dismisses after the default duration', () => {
    const store = createToastStore()
    store.publish({ message: 'Saved', tone: 'success' })
    jest.advanceTimersByTime(TOAST_DURATION_MS - 1)
    expect(store.getSnapshot()).toHaveLength(1)
    jest.advanceTimersByTime(1)
    expect(store.getSnapshot()).toHaveLength(0)
  })

  it('honors the configured duration and sticky toasts', () => {
    const store = createToastStore()
    store.configure({ duration: 1 })
    store.publish({ message: 'Short', tone: 'info' })
    jest.advanceTimersByTime(1000)
    expect(store.getSnapshot()).toHaveLength(0)

    store.configure({ duration: 0 })
    store.publish({ message: 'Sticky', tone: 'error' })
    jest.advanceTimersByTime(60_000)
    expect(store.getSnapshot()).toHaveLength(1)
  })

  it('drops toasts of disabled tones', () => {
    const store = createToastStore()
    const listener = jest.fn()
    store.subscribe(listener)
    store.configure({ disabled: ['error'] })
    store.publish({ message: 'Down', tone: 'error' })
    store.publish({ message: 'Saved', tone: 'success' })
    expect(store.getSnapshot().map((toast) => toast.message)).toEqual(['Saved'])
    store.configure({ disabled: true })
    store.publish({ message: 'Hidden', tone: 'success' })
    expect(store.getSnapshot()).toHaveLength(1)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('dismisses by id and ignores unknown ids', () => {
    const store = createToastStore()
    const listener = jest.fn()
    store.publish({ message: 'A', tone: 'info' })
    store.subscribe(listener)
    store.dismiss(42)
    expect(listener).not.toHaveBeenCalled()
    store.dismiss(0)
    expect(store.getSnapshot()).toHaveLength(0)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('bounds the queue and cancels timers of dropped toasts', () => {
    const store = createToastStore()
    for (let i = 0; i < MAX_VISIBLE_TOASTS + 2; i++) {
      store.publish({ message: `m${i}`, tone: 'info' })
    }
    expect(store.getSnapshot()).toHaveLength(MAX_VISIBLE_TOASTS)
    expect(jest.getTimerCount()).toBe(MAX_VISIBLE_TOASTS)
  })

  it('stops notifying after unsubscribe and clears everything', () => {
    const store = createToastStore()
    const listener = jest.fn()
    const unsubscribe = store.subscribe(listener)
    unsubscribe()
    store.publish({ message: 'A', tone: 'info' })
    expect(listener).not.toHaveBeenCalled()
    store.clear()
    expect(store.getSnapshot()).toHaveLength(0)
    expect(jest.getTimerCount()).toBe(0)
  })
})
